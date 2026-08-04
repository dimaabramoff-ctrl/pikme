import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CatalogProviderConfigurationError,
  CatalogProvider,
  CatalogSearchResult,
} from './catalog-provider.interface';

interface GooglePlaceItem {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: {
    openNow?: boolean;
  };
  googleMapsUri?: string;
}

interface MapboxFeatureItem {
  id?: string;
  properties?: {
    name?: string;
    address?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
}

@Injectable()
export class ExternalPlacesProvider implements CatalogProvider {
  constructor(private readonly configService: ConfigService) {}

  private static readonly GOOGLE_FIELD_MASK =
    'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.googleMapsUri';

  private static readonly GOOGLE_SUPPORTED_TYPES = [
    'hair_salon',
    'beauty_salon',
    'barber_shop',
  ] as const;

  async search(
    query: string,
    options?: {
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      category?: string;
      limit?: number;
    },
  ): Promise<CatalogSearchResult[]> {
    const provider = (
      this.configService.get<string>('GEO_PROVIDER') ??
      (process.env.NODE_ENV === 'test' ? 'fake' : 'mapbox')
    ).toLowerCase();
    const limit = Math.min(options?.limit ?? 5, 8);

    if (provider === 'fake') {
      return this.searchFake(query, options, limit);
    }

    if (provider === 'google_places' || provider === 'google') {
      return this.searchGooglePlaces(query, options, limit);
    }

    return this.searchMapbox(query, options, limit);
  }

  private async searchGooglePlaces(
    query: string,
    options?: {
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      category?: string;
      limit?: number;
    },
    limit = 5,
  ): Promise<CatalogSearchResult[]> {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new CatalogProviderConfigurationError(
        'GOOGLE_PLACES_API_KEY is not configured',
      );
    }

    const latitude = options?.latitude ?? 52.52;
    const longitude = options?.longitude ?? 13.405;
    const radiusMeters = Math.max(
      100,
      Math.min(50_000, Math.round((options?.radiusKm ?? 5) * 1000)),
    );
    const includedTypes = this.resolveGoogleIncludedTypes(
      query,
      options?.category,
    );

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': ExternalPlacesProvider.GOOGLE_FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes,
          maxResultCount: limit,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: { latitude, longitude },
              radius: radiusMeters,
            },
          },
        }),
        signal: AbortSignal.timeout(7_000),
      },
    );

    if (!response.ok) {
      throw new Error(`Provider unavailable: ${response.status}`);
    }

    const payload = (await response.json()) as {
      places?: GooglePlaceItem[];
    };
    return (payload.places ?? []).slice(0, limit).map((item, index) => ({
      id: `external-google-${item.id ?? index}`,
      source: 'EXTERNAL' as const,
      name: item.displayName?.text ?? 'Nearby salon',
      category: item.primaryType ?? options?.category ?? 'beauty_salon',
      address: item.formattedAddress ?? null,
      latitude: item.location?.latitude ?? null,
      longitude: item.location?.longitude ?? null,
      rating: item.rating ?? null,
      reviewCount: item.userRatingCount ?? null,
      openNow: item.currentOpeningHours?.openNow ?? null,
      photoUrl: null,
      externalUrl: item.googleMapsUri ?? null,
      phone: null,
      externalProvider: 'GOOGLE_PLACES',
      externalPlaceId: item.id ?? `google-${index}`,
      isPickmeConnected: false,
    }));
  }

  private resolveGoogleIncludedTypes(query: string, category?: string) {
    const normalized = `${query} ${category ?? ''}`.toLowerCase();
    const includedTypes = new Set<string>();

    if (normalized.includes('hair')) includedTypes.add('hair_salon');
    if (normalized.includes('beauty')) includedTypes.add('beauty_salon');
    if (normalized.includes('barber')) includedTypes.add('barber_shop');

    if (includedTypes.size === 0) {
      includedTypes.add('hair_salon');
      includedTypes.add('beauty_salon');
    }

    return [...includedTypes].filter((type) =>
      ExternalPlacesProvider.GOOGLE_SUPPORTED_TYPES.includes(
        type as (typeof ExternalPlacesProvider.GOOGLE_SUPPORTED_TYPES)[number],
      ),
    );
  }

  private async searchMapbox(
    query: string,
    options?: {
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      category?: string;
      limit?: number;
    },
    limit = 5,
  ): Promise<CatalogSearchResult[]> {
    const apiToken = this.configService.get<string>('MAPBOX_SERVER_TOKEN');
    if (!apiToken) {
      throw new CatalogProviderConfigurationError(
        'MAPBOX_SERVER_TOKEN is not configured',
      );
    }

    const url = new URL('https://api.mapbox.com/search/searchbox/v1/nearby');
    url.searchParams.set('access_token', apiToken);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set(
      'proximity',
      `${options?.longitude ?? 13.4},${options?.latitude ?? 52.52}`,
    );
    url.searchParams.set('language', 'en');
    url.searchParams.set(
      'query',
      `${query} ${options?.category ?? 'hair salon'}`.trim(),
    );

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) {
      throw new Error('Provider unavailable');
    }

    const payload = (await response.json()) as {
      features?: MapboxFeatureItem[];
    };
    return (payload.features ?? []).slice(0, limit).map((item, index) => ({
      id: `external-mapbox-${item.id ?? index}`,
      source: 'EXTERNAL' as const,
      name: item.properties?.name ?? 'Nearby salon',
      category: options?.category ?? 'beauty_salon',
      address: item.properties?.address ?? null,
      latitude: item.geometry?.coordinates?.[1] ?? null,
      longitude: item.geometry?.coordinates?.[0] ?? null,
      rating: null,
      reviewCount: null,
      openNow: null,
      photoUrl: null,
      externalUrl: item.id
        ? `https://www.openstreetmap.org/?mlat=${item.geometry?.coordinates?.[1] ?? ''}&mlon=${item.geometry?.coordinates?.[0] ?? ''}#map=17/${item.geometry?.coordinates?.[1] ?? ''}/${item.geometry?.coordinates?.[0] ?? ''}`
        : null,
      phone: null,
      externalProvider: 'MAPBOX',
      externalPlaceId: item.id ?? `mapbox-${index}`,
      isPickmeConnected: false,
    }));
  }

  private searchFake(
    query: string,
    options?: {
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      category?: string;
      limit?: number;
    },
    limit = 5,
  ): CatalogSearchResult[] {
    const latitude = options?.latitude ?? 52.52;
    const longitude = options?.longitude ?? 13.405;
    return Array.from({ length: Math.max(1, Math.min(limit, 3)) }).map(
      (_, index) => ({
        id: `external-fake-${index + 1}`,
        source: 'EXTERNAL',
        name: `${query || 'Nearby'} Studio ${index + 1}`,
        category: options?.category ?? 'hairdresser',
        address: `Mock Street ${index + 1}`,
        latitude: Number((latitude + index * 0.0015).toFixed(6)),
        longitude: Number((longitude + index * 0.0012).toFixed(6)),
        rating: 4.2 + index * 0.1,
        reviewCount: 20 + index * 5,
        openNow: index % 2 === 0,
        photoUrl: null,
        externalUrl: `https://example.test/places/${index + 1}`,
        phone: null,
        externalProvider: 'FAKE',
        externalPlaceId: `fake-${index + 1}`,
        isPickmeConnected: false,
      }),
    );
  }
}
