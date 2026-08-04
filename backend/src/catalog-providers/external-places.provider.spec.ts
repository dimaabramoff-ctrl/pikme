import { ConfigService } from '@nestjs/config';
import { CatalogProviderConfigurationError } from './catalog-provider.interface';
import { ExternalPlacesProvider } from './external-places.provider';

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
          results: [
            {
              place_id: 'abc123',
              name: 'Real Salon',
              vicinity: 'Main St 1',
              geometry: { location: { lat: 52.5, lng: 13.4 } },
              rating: 4.7,
              user_ratings_total: 123,
              opening_hours: { open_now: true },
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
      externalProvider: 'GOOGLE_PLACES',
      externalPlaceId: 'abc123',
      isPickmeConnected: false,
    });
  });
});
