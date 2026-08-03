import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExternalPlacesProvider } from '../catalog-providers/external-places.provider';

export interface NearbyCatalogItem {
  id: string;
  sourceType: 'PICKME' | 'EXTERNAL';
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
  openingStatus?: string | null;
  photoReference?: string | null;
  phone?: string | null;
  isBookable?: boolean;
  isPrivate?: boolean;
  isVerified?: boolean;
}

export interface NearbyCatalogQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  query?: string;
  category?: string;
  limit?: number;
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
    )
      return true;
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
    const priorityA = a.sourceType === 'PICKME' ? (a.isBookable ? 0 : 1) : 2;
    const priorityB = b.sourceType === 'PICKME' ? (b.isBookable ? 0 : 1) : 2;
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

  async getNearby(query: NearbyCatalogQuery) {
    const radiusKm = query.radiusKm ?? 5;
    const limit = query.limit ?? 12;

    const [pickmeSalons, pickmeMasters, external] = await Promise.allSettled([
      this.prisma.salon.findMany({
        where: { isActive: true },
        include: { services: { where: { isActive: true }, take: 3 } },
      }),
      this.prisma.masterProfile.findMany({
        include: {
          salonLinks: { where: { isActive: true }, include: { salon: true } },
        },
      }),
      this.externalProvider.search(query.query ?? 'hair salon', {
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm,
        category: query.category,
        limit,
      }),
    ]);

    const pickmeSalonsResult =
      pickmeSalons.status === 'fulfilled' ? pickmeSalons.value : [];
    const pickmeMastersResult =
      pickmeMasters.status === 'fulfilled' ? pickmeMasters.value : [];
    const externalResult =
      external.status === 'fulfilled' ? external.value : [];

    const pickmeItems: NearbyCatalogItem[] = [
      ...pickmeSalonsResult.map((salon) => ({
        id: `pickme-salon:${salon.id}`,
        name: salon.name,
        category: salon.country === 'Germany' ? 'beauty_salon' : 'beauty_salon',
        address: [salon.addressLine, salon.city, salon.postalCode]
          .filter(Boolean)
          .join(', '),
        latitude: salon.latitude,
        longitude: salon.longitude,
        rating: salon.ratingAverage ?? null,
        reviewCount: salon.ratingCount ?? null,
        sourceType: 'PICKME' as const,
        isBookable: true,
        isVerified: salon.isVerified,
      })),
      ...pickmeMastersResult
        .filter((master) => master.isIndependent)
        .map((master) => ({
          id: `pickme-master:${master.id}`,
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
          sourceType: 'PICKME' as const,
          isBookable: false,
          isPrivate: true,
          isVerified: master.isVerified,
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
