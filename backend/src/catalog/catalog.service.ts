import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';
import { NearbyCatalogQueryDto } from './dto/nearby-catalog-query.dto';
import {
  CatalogProviderConfigurationError,
  CatalogSearchResult,
} from '../catalog-providers/catalog-provider.interface';
import { ExternalPlacesProvider } from '../catalog-providers/external-places.provider';

export interface NearbyCatalogItem {
  id: string;
  source: 'PICKME' | 'EXTERNAL';
  externalProvider?: string | null;
  externalPlaceId?: string | null;
  name: string;
  category?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  openNow?: boolean | null;
  photoUrl?: string | null;
  externalUrl?: string | null;
  phone?: string | null;
  isPickmeConnected: boolean;
  isBookable?: boolean | null;
  isVerified?: boolean | null;
}

export function mergeNearbyResults(
  pickmeResults: NearbyCatalogItem[],
  externalResults: NearbyCatalogItem[],
  radiusKm?: number,
) {
  const combined = [...pickmeResults, ...externalResults].filter((item) => {
    if (radiusKm == null) return true;
    return item.distanceKm == null || item.distanceKm <= radiusKm;
  });
  const seen: NearbyCatalogItem[] = [];

  const isSamePlace = (left: NearbyCatalogItem, right: NearbyCatalogItem) => {
    if (
      left.externalPlaceId &&
      right.externalPlaceId &&
      left.externalPlaceId === right.externalPlaceId
    ) {
      return true;
    }

    if (
      left.latitude != null &&
      left.longitude != null &&
      right.latitude != null &&
      right.longitude != null
    ) {
      const coordinateDistance =
        Math.sqrt(
          (left.latitude - right.latitude) ** 2 +
            (left.longitude - right.longitude) ** 2,
        ) * 111;
      if (coordinateDistance <= 0.2) {
        return true;
      }
    }

    if (
      left.name.trim().toLowerCase() &&
      right.name.trim().toLowerCase() &&
      (left.address ?? '').trim().toLowerCase() &&
      (right.address ?? '').trim().toLowerCase()
    ) {
      const normalizedAddressA = (left.address ?? '').trim().toLowerCase();
      const normalizedAddressB = (right.address ?? '').trim().toLowerCase();
      if (normalizedAddressA === normalizedAddressB) {
        const normalizedNameA = left.name.trim().toLowerCase();
        const normalizedNameB = right.name.trim().toLowerCase();
        if (normalizedNameA === normalizedNameB) {
          return true;
        }
      }
    }

    const normalizedNameA = left.name.trim().toLowerCase();
    const normalizedNameB = right.name.trim().toLowerCase();
    if (
      normalizedNameA &&
      normalizedNameB &&
      normalizedNameA === normalizedNameB
    ) {
      const addressA = (left.address ?? '').trim().toLowerCase();
      const addressB = (right.address ?? '').trim().toLowerCase();
      if (addressA && addressB && addressA === addressB) return true;
      if (
        left.latitude != null &&
        left.longitude != null &&
        right.latitude != null &&
        right.longitude != null
      ) {
        const distance =
          Math.sqrt(
            (left.latitude - right.latitude) ** 2 +
              (left.longitude - right.longitude) ** 2,
          ) * 111;
        if (distance <= 0.25) return true;
      }
    }
    return false;
  };

  for (const item of combined) {
    const duplicate = seen.find((existing) => isSamePlace(existing, item));
    if (duplicate) continue;
    seen.push(item);
  }

  return seen.sort((a, b) => {
    const priorityA = a.isPickmeConnected ? 0 : 1;
    const priorityB = b.isPickmeConnected ? 0 : 1;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return (
      (a.distanceKm ?? Number.MAX_SAFE_INTEGER) -
      (b.distanceKm ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly externalProvider: ExternalPlacesProvider,
  ) {}

  async getNearby(query: NearbyCatalogQueryDto) {
    const radiusMeters = query.radius ?? query.radiusKm ?? 5000;
    const radiusKm = radiusMeters / 1000;
    const limit = query.limit ?? 12;

    const [pickmeSalons, pickmeMasters] = await Promise.all([
      this.prisma.salon.findMany({
        where: { isActive: true },
        include: { services: { where: { isActive: true }, take: 3 } },
      }),
      this.prisma.masterProfile.findMany({
        include: {
          salonLinks: { where: { isActive: true }, include: { salon: true } },
        },
      }),
    ]);

    let externalResult: CatalogSearchResult[] = [];
    try {
      externalResult = await this.externalProvider.search(
        query.query ?? 'hair salon',
        {
          latitude: query.latitude,
          longitude: query.longitude,
          radiusKm,
          category: query.category,
          limit,
        },
      );
    } catch (error) {
      if (error instanceof CatalogProviderConfigurationError) {
        throw new ServiceUnavailableException(
          buildApiError(
            503,
            'CATALOG_PROVIDER_NOT_CONFIGURED',
            'Внешний каталог не настроен. Проверьте конфигурацию provider key.',
          ),
        );
      }
      throw new ServiceUnavailableException(
        buildApiError(
          503,
          'CATALOG_PROVIDER_UNAVAILABLE',
          'Внешний каталог временно недоступен.',
        ),
      );
    }

    const pickmeItems: NearbyCatalogItem[] = [
      ...pickmeSalons.map((salon) => ({
        id: `pickme-salon:${salon.id}`,
        source: 'PICKME' as const,
        name: salon.name,
        category: salon.country === 'Germany' ? 'beauty_salon' : 'beauty_salon',
        address: [salon.addressLine, salon.city, salon.postalCode]
          .filter(Boolean)
          .join(', '),
        latitude: salon.latitude,
        longitude: salon.longitude,
        rating: salon.ratingAverage ?? null,
        reviewCount: salon.ratingCount ?? null,
        openNow: null,
        photoUrl: null,
        externalUrl: null,
        phone: salon.phone ?? null,
        isPickmeConnected: true,
        isBookable: true,
        isVerified: salon.isVerified ?? null,
      })),
      ...pickmeMasters
        .filter((master) => master.isIndependent)
        .map((master) => ({
          id: `pickme-master:${master.id}`,
          source: 'PICKME' as const,
          name: master.displayName,
          category: 'barber',
          address:
            master.publicLatitude && master.publicLongitude
              ? 'Геолокация мастера'
              : 'Профиль мастера',
          latitude: master.publicLatitude,
          longitude: master.publicLongitude,
          rating: master.ratingAverage ?? null,
          reviewCount: master.reviewCount ?? null,
          openNow: null,
          photoUrl: master.avatarUrl ?? null,
          externalUrl: null,
          phone: null,
          isPickmeConnected: true,
          isBookable: false,
          isVerified: master.isVerified ?? null,
        })),
    ].map((item) => ({
      ...item,
      distanceKm: this.calculateDistanceKm(
        query.latitude,
        query.longitude,
        item.latitude ?? query.latitude,
        item.longitude ?? query.longitude,
      ),
    }));

    const externalItems: NearbyCatalogItem[] = externalResult.map((item) => ({
      ...item,
      distanceKm: this.calculateDistanceKm(
        query.latitude,
        query.longitude,
        item.latitude ?? query.latitude,
        item.longitude ?? query.longitude,
      ),
    }));

    return mergeNearbyResults(pickmeItems, externalItems, radiusKm).slice(
      0,
      limit,
    );
  }

  private calculateDistanceKm(
    latitude1: number,
    longitude1: number,
    latitude2: number | null | undefined,
    longitude2: number | null | undefined,
  ) {
    if (latitude2 == null || longitude2 == null) return null;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(latitude2 - latitude1);
    const dLon = toRad((longitude2 ?? 0) - longitude1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(latitude1)) *
        Math.cos(toRad(latitude2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((earthRadiusKm * c).toFixed(2));
  }
}
