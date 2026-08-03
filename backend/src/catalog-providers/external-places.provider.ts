import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
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
      this.configService.get<string>('GEO_PROVIDER') ?? 'mapbox'
    ).toLowerCase();
    const limit = Math.min(options?.limit ?? 5, 8);

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
      return [];
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
      name: item.name ?? 'Nearby salon',
      category: category,
      address: item.vicinity ?? item.formatted_address ?? null,
      latitude: item.geometry?.location?.lat ?? null,
      longitude: item.geometry?.location?.lng ?? null,
      rating: item.rating ?? null,
      reviewCount: item.user_ratings_total ?? null,
      openingStatus:
        item.opening_hours?.open_now != null
          ? item.opening_hours.open_now
            ? 'OPEN'
            : 'CLOSED'
          : null,
      photoReference: item.photos?.[0]?.photo_reference ?? null,
      phone: null,
      sourceType: 'EXTERNAL' as const,
      externalProvider: 'GOOGLE_PLACES',
      externalPlaceId: item.place_id ?? `google-${index}`,
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
      return [];
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
      name: item.properties?.name ?? 'Nearby salon',
      category: options?.category ?? 'beauty_salon',
      address: item.properties?.address ?? null,
      latitude: item.geometry?.coordinates?.[1] ?? null,
      longitude: item.geometry?.coordinates?.[0] ?? null,
      rating: null,
      reviewCount: null,
      openingStatus: null,
      photoReference: null,
      phone: null,
      sourceType: 'EXTERNAL' as const,
      externalProvider: 'MAPBOX',
      externalPlaceId: item.id ?? `mapbox-${index}`,
    }));
  }
}
