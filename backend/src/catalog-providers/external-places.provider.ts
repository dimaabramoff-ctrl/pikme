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
    weekdayDescriptions?: string[];
  };
  types?: string[];
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  photos?: GooglePlacePhoto[];
}

interface GoogleNearbySearchResponse {
  places?: GooglePlaceItem[];
}

interface GoogleApiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface GooglePlacePhoto {
  name?: string;
  widthPx?: number;
  heightPx?: number;
}

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface GooglePlaceDetailsResponse {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: {
    latitude?: number;
    longitude?: number;
  };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
  photos?: GooglePlacePhoto[];
  googleMapsUri?: string;
}

export interface GooglePlaceDetails {
  externalPlaceId: string;
  name: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  categories: string[];
  photoReferences: string[];
  addressComponents: {
    street: string | null;
    houseNumber: string | null;
    postalCode: string | null;
    city: string | null;
    country: string | null;
    countryCode: string | null;
  };
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

export interface AggregatedNearbyDiagnostics {
  provider: 'GOOGLE_PLACES' | 'MAPBOX' | 'FAKE';
  requestsMade: number;
  rawResults: number;
  uniqueResults: number;
  radiusMetersUsed: number;
}

export interface AggregatedNearbyResult {
  items: CatalogSearchResult[];
  diagnostics: AggregatedNearbyDiagnostics;
}

export class GoogleNearbyApiError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly googleStatus: string | null,
    readonly safeMessage: string,
    readonly requestId: string | null,
    readonly fieldMask: string,
  ) {
    super(
      `Google Nearby API error: status=${httpStatus}, googleStatus=${googleStatus ?? 'UNKNOWN'}`,
    );
  }
}

@Injectable()
export class ExternalPlacesProvider implements CatalogProvider {
  constructor(private readonly configService: ConfigService) {}

  private static readonly GOOGLE_SEARCH_FIELD_MASK =
    'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.currentOpeningHours.weekdayDescriptions,places.primaryType,places.types,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber,places.photos';

  private static readonly GOOGLE_DETAILS_FIELD_MASK =
    'id,displayName,formattedAddress,addressComponents,location,rating,userRatingCount,nationalPhoneNumber,internationalPhoneNumber,websiteUri,types,photos.name,photos.widthPx,photos.heightPx,googleMapsUri';

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
    const limit = Math.min(options?.limit ?? 20, 20);

    if (provider === 'fake') {
      return this.searchFake(query, options, limit);
    }

    if (provider === 'google_places' || provider === 'google') {
      return this.searchGooglePlaces(query, options, limit);
    }

    return this.searchMapbox(query, options, limit);
  }

  async searchAggregatedNearby(
    query: string,
    options?: {
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      category?: string;
      limit?: number;
      maxRequests?: number;
    },
  ): Promise<AggregatedNearbyResult> {
    const provider = (
      this.configService.get<string>('GEO_PROVIDER') ??
      (process.env.NODE_ENV === 'test' ? 'fake' : 'mapbox')
    ).toLowerCase();

    const radiusMeters = Math.max(
      500,
      Math.min(15_000, Math.round((options?.radiusKm ?? 15) * 1000)),
    );

    if (provider === 'google_places' || provider === 'google') {
      return this.searchGooglePlacesAggregated(query, {
        ...options,
        radiusKm: radiusMeters / 1000,
      });
    }

    const single = await this.search(query, {
      ...options,
      radiusKm: radiusMeters / 1000,
      limit: Math.min(options?.limit ?? 50, 50),
    });
    return {
      items: single,
      diagnostics: {
        provider: provider === 'fake' ? 'FAKE' : 'MAPBOX',
        requestsMade: 1,
        rawResults: single.length,
        uniqueResults: single.length,
        radiusMetersUsed: radiusMeters,
      },
    };
  }

  async getGooglePlaceDetails(placeId: string): Promise<GooglePlaceDetails> {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new CatalogProviderConfigurationError(
        'GOOGLE_PLACES_API_KEY is not configured',
      );
    }

    const normalizedPlaceId = placeId.trim();
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(normalizedPlaceId)}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': ExternalPlacesProvider.GOOGLE_DETAILS_FIELD_MASK,
        },
        signal: AbortSignal.timeout(7_000),
      },
    );

    if (!response.ok) {
      throw new Error(`Provider unavailable: ${response.status}`);
    }

    const payload = (await response.json()) as GooglePlaceDetailsResponse;
    const byType = this.mapAddressComponents(payload.addressComponents ?? []);

    return {
      externalPlaceId: payload.id ?? normalizedPlaceId,
      name: payload.displayName?.text ?? null,
      formattedAddress: payload.formattedAddress ?? null,
      latitude: payload.location?.latitude ?? null,
      longitude: payload.location?.longitude ?? null,
      phone:
        payload.internationalPhoneNumber ?? payload.nationalPhoneNumber ?? null,
      website: payload.websiteUri ?? payload.googleMapsUri ?? null,
      rating: payload.rating ?? null,
      reviewCount: payload.userRatingCount ?? null,
      categories: payload.types ?? [],
      photoReferences: (payload.photos ?? [])
        .map((photo) => photo.name)
        .filter((value): value is string => Boolean(value)),
      addressComponents: byType,
    };
  }

  async getGooglePhotoMedia(
    photoName: string,
    options?: { maxHeightPx?: number; maxWidthPx?: number },
  ): Promise<{ contentType: string; buffer: Buffer; cacheControl?: string }> {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new CatalogProviderConfigurationError(
        'GOOGLE_PLACES_API_KEY is not configured',
      );
    }

    const normalizedName = photoName.trim().replace(/^\/+/, '');
    const url = new URL(
      `https://places.googleapis.com/v1/${encodeURI(normalizedName)}/media`,
    );

    if (options?.maxWidthPx && options.maxWidthPx > 0) {
      url.searchParams.set('maxWidthPx', String(options.maxWidthPx));
    }

    if (options?.maxHeightPx && options.maxHeightPx > 0) {
      url.searchParams.set('maxHeightPx', String(options.maxHeightPx));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Google photo unavailable: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      contentType: response.headers.get('content-type') ?? 'image/jpeg',
      cacheControl: response.headers.get('cache-control') ?? undefined,
      buffer,
    };
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
          'X-Goog-FieldMask': ExternalPlacesProvider.GOOGLE_SEARCH_FIELD_MASK,
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

    const results = await Promise.all(
      (payload.places ?? []).slice(0, limit).map(async (item, index) => {
        const externalPlaceId = item.id ?? `google-${index}`;
        const searchPhoto = item.photos?.[0]?.name;
        const photoUrl = searchPhoto
          ? `/api/catalog/google-photo?name=${encodeURIComponent(searchPhoto)}&maxHeight=640`
          : null;

        if (searchPhoto) {
          return {
            id: `external-google-${externalPlaceId}`,
            source: 'EXTERNAL' as const,
            name: item.displayName?.text ?? 'Nearby salon',
            category: item.primaryType ?? options?.category ?? 'beauty_salon',
            address: item.formattedAddress ?? null,
            latitude: item.location?.latitude ?? null,
            longitude: item.location?.longitude ?? null,
            rating: item.rating ?? null,
            reviewCount: item.userRatingCount ?? null,
            openNow: item.currentOpeningHours?.openNow ?? null,
            photoUrl,
            externalUrl: item.googleMapsUri ?? null,
            phone: null,
            externalProvider: 'GOOGLE_PLACES',
            externalPlaceId,
            isPickmeConnected: false,
          };
        }

        try {
          const details = await this.getGooglePlaceDetails(externalPlaceId);
          const detailPhoto = details.photoReferences[0];
          return {
            id: `external-google-${externalPlaceId}`,
            source: 'EXTERNAL' as const,
            name: item.displayName?.text ?? details.name ?? 'Nearby salon',
            category: item.primaryType ?? options?.category ?? 'beauty_salon',
            address: item.formattedAddress ?? details.formattedAddress ?? null,
            latitude: item.location?.latitude ?? details.latitude ?? null,
            longitude: item.location?.longitude ?? details.longitude ?? null,
            rating: item.rating ?? details.rating ?? null,
            reviewCount: item.userRatingCount ?? details.reviewCount ?? null,
            openNow: item.currentOpeningHours?.openNow ?? null,
            photoUrl: detailPhoto
              ? `/api/catalog/google-photo?name=${encodeURIComponent(detailPhoto)}&maxHeight=640`
              : null,
            externalUrl: item.googleMapsUri ?? null,
            phone: null,
            externalProvider: 'GOOGLE_PLACES',
            externalPlaceId,
            isPickmeConnected: false,
          };
        } catch {
          return {
            id: `external-google-${externalPlaceId}`,
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
            externalPlaceId,
            isPickmeConnected: false,
          };
        }
      }),
    );

    return results;
  }

  private async searchGooglePlacesAggregated(
    query: string,
    options?: {
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      category?: string;
      limit?: number;
      maxRequests?: number;
    },
  ): Promise<AggregatedNearbyResult> {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new CatalogProviderConfigurationError(
        'GOOGLE_PLACES_API_KEY is not configured',
      );
    }

    const originLat = options?.latitude ?? 52.52;
    const originLng = options?.longitude ?? 13.405;
    const radiusMeters = Math.max(
      500,
      Math.min(15_000, Math.round((options?.radiusKm ?? 15) * 1000)),
    );
    const includedTypes = this.resolveGoogleIncludedTypes(
      query,
      options?.category,
    );

    const zoneCenters = this.buildZoneCenters(originLat, originLng, radiusMeters);
    const maxRequests = Math.max(1, Math.min(options?.maxRequests ?? 24, 36));
    const limitedZones = zoneCenters.slice(0, maxRequests);
    const concurrencyLimit = Math.max(1, Math.min(3, limitedZones.length));

    let requestsMade = 0;
    let rawResults = 0;
    const rawItems: GooglePlaceItem[] = [];
    let lastZoneError: unknown = null;

    let nextZoneIndex = 0;
    const workers = Array.from({ length: concurrencyLimit }, async () => {
      while (nextZoneIndex < limitedZones.length) {
        const zone = limitedZones[nextZoneIndex];
        nextZoneIndex += 1;

        try {
          const payload = await this.fetchGoogleNearbyPageWithRetry({
            apiKey,
            latitude: zone.latitude,
            longitude: zone.longitude,
            radiusMeters: zone.radiusMeters,
            includedTypes,
          });

          requestsMade += 1;

          const places = payload.places ?? [];
          rawResults += places.length;
          rawItems.push(...places);
        } catch (error) {
          lastZoneError = error;
        }
      }
    });
    await Promise.all(workers);

    if (rawItems.length === 0 && lastZoneError) {
      throw lastZoneError;
    }

    const uniqueById = new Map<string, GooglePlaceItem>();
    for (const item of rawItems) {
      if (!item.id) continue;
      if (!uniqueById.has(item.id)) {
        uniqueById.set(item.id, item);
      }
    }

    const mappedRaw = [...uniqueById.values()]
      .map((item, index) => {
        const lat = item.location?.latitude ?? null;
        const lng = item.location?.longitude ?? null;
        const distanceKm =
          lat != null && lng != null
            ? this.distanceKm(originLat, originLng, lat, lng)
            : null;

        if (distanceKm != null && distanceKm > radiusMeters / 1000) {
          return null;
        }

        const externalPlaceId = item.id ?? `google-${index}`;
        const searchPhoto = item.photos?.[0]?.name;
        return {
          id: `external-google-${externalPlaceId}`,
          source: 'EXTERNAL' as const,
          name: item.displayName?.text ?? 'Nearby salon',
          category: item.primaryType ?? options?.category ?? 'beauty_salon',
          address: item.formattedAddress ?? null,
          latitude: lat,
          longitude: lng,
          rating: item.rating ?? null,
          reviewCount: item.userRatingCount ?? null,
          openNow: item.currentOpeningHours?.openNow ?? null,
          photoUrl: searchPhoto
            ? `/api/catalog/google-photo?name=${encodeURIComponent(searchPhoto)}&maxHeight=640`
            : null,
          externalUrl: item.googleMapsUri ?? null,
          phone: null,
          externalProvider: 'GOOGLE_PLACES',
          externalPlaceId,
          isPickmeConnected: false,
          __distanceKm: distanceKm,
        };
      });

    const mapped = mappedRaw.filter(Boolean) as Array<
      CatalogSearchResult & { __distanceKm: number | null }
    >;

    mapped.sort((a, b) => {
      const distanceA = a.__distanceKm ?? Number.MAX_SAFE_INTEGER;
      const distanceB = b.__distanceKm ?? Number.MAX_SAFE_INTEGER;
      if (distanceA !== distanceB) return distanceA - distanceB;
      const ratingA = a.rating ?? 0;
      const ratingB = b.rating ?? 0;
      if (ratingA !== ratingB) return ratingB - ratingA;
      return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    });

    const items = mapped
      .slice(0, Math.min(options?.limit ?? 300, 300))
      .map((item) => {
        const { __distanceKm: _distanceKm, ...rest } = item;
        return rest;
      });

    return {
      items,
      diagnostics: {
        provider: 'GOOGLE_PLACES',
        requestsMade,
        rawResults,
        uniqueResults: items.length,
        radiusMetersUsed: radiusMeters,
      },
    };
  }

  private buildZoneCenters(
    latitude: number,
    longitude: number,
    radiusMeters: number,
  ) {
    if (radiusMeters <= 5_000) {
      return [{ latitude, longitude, radiusMeters }];
    }

    const zoneRadius = Math.max(1_500, Math.min(5_000, Math.round(radiusMeters * 0.38)));
    const ringDistanceKm = Math.max(0.5, (radiusMeters - zoneRadius - 250) / 1000);
    const centers = [{ latitude, longitude, radiusMeters: zoneRadius }];

    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i;
      const dLat = (ringDistanceKm / 111) * Math.cos(angle);
      const dLng =
        (ringDistanceKm / (111 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.2))) *
        Math.sin(angle);

      centers.push({
        latitude: latitude + dLat,
        longitude: longitude + dLng,
        radiusMeters: zoneRadius,
      });
    }

    return centers.filter((center) => {
      const distanceMeters =
        this.distanceKm(
          latitude,
          longitude,
          center.latitude,
          center.longitude,
        ) * 1000;
      return distanceMeters + center.radiusMeters <= radiusMeters;
    });
  }

  private async fetchGoogleNearbyPageWithRetry(input: {
    apiKey: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    includedTypes: string[];
  }): Promise<GoogleNearbySearchResponse> {
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        return await this.fetchGoogleNearbyPage(input);
      } catch (error) {
        attempt += 1;
        const isRetriableHttpStatus =
          error instanceof GoogleNearbyApiError &&
          [429, 500, 502, 503, 504].includes(error.httpStatus);
        const isAbortError =
          error instanceof Error && error.name.toLowerCase().includes('abort');
        const isRetriable = isRetriableHttpStatus || isAbortError;

        if (!isRetriable || attempt >= maxAttempts) {
          throw error;
        }
      }
    }

    return { places: [] };
  }

  private async fetchGoogleNearbyPage(input: {
    apiKey: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    includedTypes: string[];
  }): Promise<GoogleNearbySearchResponse> {
    const fieldMask = ExternalPlacesProvider.GOOGLE_SEARCH_FIELD_MASK;
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': input.apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify({
          includedTypes: input.includedTypes,
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: {
                latitude: input.latitude,
                longitude: input.longitude,
              },
              radius: input.radiusMeters,
            },
          },
        }),
        signal: AbortSignal.timeout(7_000),
      },
    );

    if (!response.ok) {
      let googleStatus: string | null = null;
      let safeMessage = `Google Nearby unavailable: HTTP ${response.status}`;

      try {
        const payload = (await response.json()) as GoogleApiErrorBody;
        googleStatus = payload.error?.status ?? null;
        if (payload.error?.message) {
          safeMessage = payload.error.message;
        }
      } catch {
        // Ignore JSON parsing errors and keep safe fallback message.
      }

      const requestId =
        response.headers.get('x-request-id') ??
        response.headers.get('x-goog-request-id') ??
        null;

      throw new GoogleNearbyApiError(
        response.status,
        googleStatus,
        safeMessage,
        requestId,
        fieldMask,
      );
    }

    return (await response.json()) as GoogleNearbySearchResponse;
  }

  private distanceKm(
    latitudeA: number,
    longitudeA: number,
    latitudeB: number,
    longitudeB: number,
  ) {
    const rad = Math.PI / 180;
    const dLat = (latitudeB - latitudeA) * rad;
    const dLon = (longitudeB - longitudeA) * rad;
    const lat1 = latitudeA * rad;
    const lat2 = latitudeB * rad;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

  private mapAddressComponents(components: GoogleAddressComponent[]) {
    const byType = new Map<string, GoogleAddressComponent>();
    for (const component of components) {
      for (const type of component.types ?? []) {
        if (!byType.has(type)) {
          byType.set(type, component);
        }
      }
    }

    const getLong = (type: string) => byType.get(type)?.longText ?? null;
    const getShort = (type: string) => byType.get(type)?.shortText ?? null;

    return {
      street: getLong('route'),
      houseNumber: getLong('street_number'),
      postalCode: getLong('postal_code'),
      city:
        getLong('locality') ??
        getLong('postal_town') ??
        getLong('administrative_area_level_2'),
      country: getLong('country'),
      countryCode: getShort('country'),
    };
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
