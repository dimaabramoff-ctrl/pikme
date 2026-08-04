import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CatalogProviderConfigurationError,
  CatalogProvider,
  CatalogSearchResult,
} from './catalog-provider.interface';

interface GooglePlacesResultItem {
  place_id?: string;
  name?: string;
  vicinity?: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    open_now?: boolean;
  };
  photos?: Array<{
    photo_reference?: string;
  }>;
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

    const radiusMeters = Math.round((options?.radiusKm ?? 5) * 1000);
    const category = options?.category ?? 'hairdresser';
    const location =
      options?.latitude != null && options?.longitude != null
        ? `${options.latitude},${options.longitude}`
        : undefined;

    const url = new URL(
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
    );
    url.searchParams.set('key', apiKey);
    url.searchParams.set('keyword', `${query} ${category}`.trim());
    url.searchParams.set('rankby', 'distance');
    if (location) url.searchParams.set('location', location);
    if (radiusMeters) url.searchParams.set('radius', String(radiusMeters));

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) {
      throw new Error('Provider unavailable');
    }

    const payload = (await response.json()) as {
      results?: GooglePlacesResultItem[];
    };
    return (payload.results ?? []).slice(0, limit).map((item, index) => ({
      id: `external-google-${item.place_id ?? index}`,
      source: 'EXTERNAL' as const,
      name: item.name ?? 'Nearby salon',
      category: category,
      address: item.vicinity ?? item.formatted_address ?? null,
      latitude: item.geometry?.location?.lat ?? null,
      longitude: item.geometry?.location?.lng ?? null,
      rating: item.rating ?? null,
      reviewCount: item.user_ratings_total ?? null,
      openNow: item.opening_hours?.open_now ?? null,
      photoUrl: null,
      externalUrl: item.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(item.place_id)}`
        : null,
      phone: null,
      externalProvider: 'GOOGLE_PLACES',
      externalPlaceId: item.place_id ?? `google-${index}`,
      isPickmeConnected: false,
    }));
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
