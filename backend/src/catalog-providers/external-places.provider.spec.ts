import { ConfigService } from '@nestjs/config';
import { CatalogProviderConfigurationError } from './catalog-provider.interface';
import { ExternalPlacesProvider } from './external-places.provider';

function okResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: () => null,
    },
    json: () => Promise.resolve(payload),
  };
}

function errorResponse(
  status: number,
  payload: unknown,
  requestId: string | null = null,
) {
  return {
    ok: false,
    status,
    headers: {
      get: (key: string) => {
        if (key.toLowerCase() === 'x-goog-request-id') return requestId;
        return null;
      },
    },
    json: () => Promise.resolve(payload),
  };
}

describe('ExternalPlacesProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.NODE_ENV;
  });

  it('returns deterministic fake places in test mode', async () => {
    process.env.NODE_ENV = 'test';
    const config = new ConfigService({});
    const provider = new ExternalPlacesProvider(config);

    const result = await provider.search('salon', {
      latitude: 52.52,
      longitude: 13.405,
      limit: 2,
    });

    expect(result).toHaveLength(2);
    expect(result[0].source).toBe('EXTERNAL');
    expect(result[0].isPickmeConnected).toBe(false);
    expect(result[0].externalProvider).toBe('FAKE');
  });

  it('throws configuration error when mapbox key is missing', async () => {
    process.env.NODE_ENV = 'development';
    const config = new ConfigService({ GEO_PROVIDER: 'mapbox' });
    const provider = new ExternalPlacesProvider(config);

    await expect(
      provider.search('salon', { latitude: 52.52, longitude: 13.405 }),
    ).rejects.toBeInstanceOf(CatalogProviderConfigurationError);
  });

  it('throws configuration error when google places key is missing', async () => {
    process.env.NODE_ENV = 'development';
    const config = new ConfigService({ GEO_PROVIDER: 'google' });
    const provider = new ExternalPlacesProvider(config);

    await expect(
      provider.searchAggregatedNearby('friseur', {
        latitude: 52.52,
        longitude: 13.405,
        radiusKm: 15,
        maxRequests: 1,
      }),
    ).rejects.toBeInstanceOf(CatalogProviderConfigurationError);
  });

  it('normalizes google places payload', async () => {
    process.env.NODE_ENV = 'development';
    const config = new ConfigService({
      GEO_PROVIDER: 'google',
      GOOGLE_PLACES_API_KEY: 'fake-key',
    });
    const provider = new ExternalPlacesProvider(config);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          places: [
            {
              id: 'abc123',
              displayName: { text: 'Real Salon' },
              formattedAddress: 'Main St 1',
              location: { latitude: 52.5, longitude: 13.4 },
              primaryType: 'hair_salon',
              rating: 4.7,
              userRatingCount: 123,
              currentOpeningHours: { openNow: true },
              googleMapsUri: 'https://maps.google.com/?cid=abc123',
            },
          ],
        }),
    });

    const result = await provider.search('salon', {
      latitude: 52.52,
      longitude: 13.405,
      limit: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'external-google-abc123',
      source: 'EXTERNAL',
      name: 'Real Salon',
      address: 'Main St 1',
      latitude: 52.5,
      longitude: 13.4,
      rating: 4.7,
      reviewCount: 123,
      openNow: true,
      externalUrl: 'https://maps.google.com/?cid=abc123',
      externalProvider: 'GOOGLE_PLACES',
      externalPlaceId: 'abc123',
      isPickmeConnected: false,
    });
  });

  it('uses nearby field mask without nextPageToken and handles places-only response', async () => {
    process.env.NODE_ENV = 'development';
    const config = new ConfigService({
      GEO_PROVIDER: 'google',
      GOOGLE_PLACES_API_KEY: 'fake-key',
    });
    const provider = new ExternalPlacesProvider(config);
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        okResponse({
          places: [
            {
              id: 'p-1',
              displayName: { text: 'Zone Salon' },
              formattedAddress: 'One St',
              location: { latitude: 53.3255, longitude: 11.4965 },
              primaryType: 'hair_salon',
              rating: 4.2,
              userRatingCount: 8,
            },
          ],
        }),
      );
    global.fetch = fetchMock as never;

    const result = await provider.searchAggregatedNearby('friseur', {
      latitude: 53.3254,
      longitude: 11.4964,
      radiusKm: 15,
      limit: 20,
      maxRequests: 1,
    });

    expect(result.items).toHaveLength(1);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const mask = (request.headers as Record<string, string>)['X-Goog-FieldMask'];
    expect(mask).toBeDefined();
    expect(mask).not.toContain('nextPageToken');
    expect(mask).toContain('places.id');
  });

  it('aggregates multiple zones, deduplicates by place id and filters out-of-radius', async () => {
    process.env.NODE_ENV = 'development';
    const config = new ConfigService({
      GEO_PROVIDER: 'google',
      GOOGLE_PLACES_API_KEY: 'fake-key',
    });
    const provider = new ExternalPlacesProvider(config);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        okResponse({
          places: [
            {
              id: 'dup-1',
              displayName: { text: 'Dup Salon' },
              formattedAddress: 'A',
              location: { latitude: 53.326, longitude: 11.497 },
              primaryType: 'hair_salon',
            },
            {
              id: 'near-2',
              displayName: { text: 'Near Salon' },
              formattedAddress: 'B',
              location: { latitude: 53.32, longitude: 11.49 },
              primaryType: 'hair_salon',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        okResponse({
          places: [
            {
              id: 'dup-1',
              displayName: { text: 'Dup Salon copy' },
              formattedAddress: 'A2',
              location: { latitude: 53.3261, longitude: 11.4971 },
              primaryType: 'hair_salon',
            },
            {
              id: 'far-3',
              displayName: { text: 'Too Far Salon' },
              formattedAddress: 'FAR',
              location: { latitude: 53.7, longitude: 12.2 },
              primaryType: 'hair_salon',
            },
          ],
        }),
      );
    global.fetch = fetchMock as never;

    const result = await provider.searchAggregatedNearby('friseur', {
      latitude: 53.3254,
      longitude: 11.4964,
      radiusKm: 15,
      limit: 50,
      maxRequests: 2,
    });

    expect(result.items.map((item) => item.externalPlaceId)).toEqual(
      expect.arrayContaining(['dup-1', 'near-2']),
    );
    expect(result.items.map((item) => item.externalPlaceId)).not.toContain('far-3');
    expect(result.items.filter((item) => item.externalPlaceId === 'dup-1')).toHaveLength(1);
    expect(result.diagnostics.requestsMade).toBe(2);
    expect(result.diagnostics.rawResults).toBe(4);
  });

  it('retries temporary google 5xx once and succeeds', async () => {
    process.env.NODE_ENV = 'development';
    const config = new ConfigService({
      GEO_PROVIDER: 'google',
      GOOGLE_PLACES_API_KEY: 'fake-key',
    });
    const provider = new ExternalPlacesProvider(config);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        errorResponse(503, {
          error: {
            status: 'UNAVAILABLE',
            message: 'temporary outage',
          },
        }),
      )
      .mockResolvedValueOnce(okResponse({ places: [] }));
    global.fetch = fetchMock as never;

    await expect(
      provider.searchAggregatedNearby('friseur', {
        latitude: 53.3254,
        longitude: 11.4964,
        radiusKm: 15,
        maxRequests: 1,
      }),
    ).resolves.toMatchObject({
      diagnostics: {
        requestsMade: 1,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry INVALID_ARGUMENT errors', async () => {
    process.env.NODE_ENV = 'development';
    const config = new ConfigService({
      GEO_PROVIDER: 'google',
      GOOGLE_PLACES_API_KEY: 'fake-key',
    });
    const provider = new ExternalPlacesProvider(config);

    const fetchMock = jest.fn().mockResolvedValue(
      errorResponse(
        400,
        {
          error: {
            status: 'INVALID_ARGUMENT',
            message: 'invalid field mask',
          },
        },
        'req-123',
      ),
    );
    global.fetch = fetchMock as never;

    await expect(
      provider.searchAggregatedNearby('friseur', {
        latitude: 53.3254,
        longitude: 11.4964,
        radiusKm: 15,
        maxRequests: 1,
      }),
    ).rejects.toThrow('INVALID_ARGUMENT');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
