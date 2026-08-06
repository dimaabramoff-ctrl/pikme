import { CatalogService, mergeNearbyResults } from './catalog.service';
import { GoogleNearbyApiError } from '../catalog-providers/external-places.provider';

const externalOperationalDefaults = {
  mastersOnShift: null,
  availableMasters: null,
  busyMasters: null,
  nextAvailableSlot: null,
  minPrice: null,
  onlineBookingAvailable: false,
};

const pickmeOperationalDefaults = {
  mastersOnShift: 0,
  availableMasters: 0,
  busyMasters: 0,
  nextAvailableSlot: null,
  minPrice: null,
  onlineBookingAvailable: false,
};

describe('mergeNearbyResults', () => {
  it('filters out distant entries when the radius is small', () => {
    const merged = mergeNearbyResults(
      [
        {
          id: 'pickme-1',
          name: 'Nearby PickMe Salon',
          category: 'hairdresser',
          address: 'Ludwigslust Center',
          latitude: 53.32,
          longitude: 11.49,
          distanceKm: 1.2,
          source: 'PICKME' as const,
          isPickmeConnected: true,
          isBookable: true,
          ...pickmeOperationalDefaults,
        },
      ],
      [
        {
          id: 'external-1',
          name: 'Distant Berlin Salon',
          category: 'beauty_salon',
          address: 'Berlin Mitte',
          latitude: 52.52,
          longitude: 13.4,
          distanceKm: 153,
          source: 'EXTERNAL' as const,
          isPickmeConnected: false,
          externalProvider: 'GOOGLE_PLACES',
          externalPlaceId: 'place-1',
          ...externalOperationalDefaults,
        },
      ],
      5,
    );

    expect(merged.map((item) => item.id)).toEqual(['pickme-1']);
  });

  it('merges pickme and external results while deduping near duplicates', () => {
    const merged = mergeNearbyResults(
      [
        {
          id: 'pickme-1',
          name: 'Mitte Style Lab',
          category: 'hairdresser',
          address: 'Testplatz 10, Berlin',
          latitude: 52.53,
          longitude: 13.38,
          source: 'PICKME' as const,
          isPickmeConnected: true,
          isBookable: true,
          ...pickmeOperationalDefaults,
        },
        {
          id: 'pickme-2',
          name: 'Private Master',
          category: 'barber',
          address: 'Hauptstrasse 5, Berlin',
          latitude: 52.54,
          longitude: 13.39,
          source: 'PICKME' as const,
          isPickmeConnected: true,
          isBookable: false,
          ...pickmeOperationalDefaults,
        },
      ],
      [
        {
          id: 'external-1',
          name: 'Mitte Style Lab',
          category: 'hairdresser',
          address: 'Testplatz 10, Berlin',
          latitude: 52.5301,
          longitude: 13.3802,
          source: 'EXTERNAL' as const,
          isPickmeConnected: false,
          externalProvider: 'GOOGLE_PLACES',
          externalPlaceId: 'place-1',
          ...externalOperationalDefaults,
        },
        {
          id: 'external-2',
          name: 'Another Nearby Salon',
          category: 'beauty_salon',
          address: 'Neue Schönhauser Strasse 2, Berlin',
          latitude: 52.55,
          longitude: 13.4,
          source: 'EXTERNAL' as const,
          isPickmeConnected: false,
          externalProvider: 'GOOGLE_PLACES',
          externalPlaceId: 'place-2',
          ...externalOperationalDefaults,
        },
      ],
    );

    expect(merged.map((item) => item.id)).toEqual([
      'pickme-1',
      'pickme-2',
      'external-2',
    ]);
    expect(merged[0].source).toBe('PICKME');
    expect(merged[2].source).toBe('EXTERNAL');
    expect(merged.every((item) => item.name)).toBe(true);
  });
});

describe('CatalogService.getNearby operational fields', () => {
  it('calculates live availability for independent PickMe masters', async () => {
    const now = new Date();
    const dayOfWeek = now.getDay();

    const prisma = {
      salon: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      masterProfile: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'master-1',
            displayName: 'Mina Mobile',
            isIndependent: true,
            currentStatus: 'AVAILABLE',
            acceptsBookings: true,
            avatarUrl: null,
            ratingAverage: 4.9,
            reviewCount: 31,
            isVerified: true,
            publicLatitude: 52.53,
            publicLongitude: 13.38,
            salonLinks: [],
          },
        ]),
      },
      salonMaster: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      workingSchedule: {
        findMany: jest.fn().mockResolvedValue([
          {
            masterId: 'master-1',
            dayOfWeek,
            shiftStart: '00:00',
            shiftEnd: '23:59',
            isDayOff: false,
            acceptsBookings: true,
          },
        ]),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      masterService: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const provider = {
      searchAggregatedNearby: jest.fn().mockResolvedValue({
        items: [],
        diagnostics: {
          provider: 'GOOGLE_PLACES',
          requestsMade: 0,
          rawResults: 0,
          uniqueResults: 0,
          radiusMetersUsed: 5000,
        },
      }),
    };

    const service = new CatalogService(prisma as never, provider as never);

    const result = await service.getNearby({
      latitude: 52.52,
      longitude: 13.405,
      radius: 5000,
      limit: 10,
      category: 'barber_shop',
      query: 'mobile friseur',
    });

    const masterItem = result.items.find((item) => item.id === 'pickme-master:master-1');

    expect(masterItem).toBeDefined();
    expect(masterItem?.mastersOnShift).toBe(1);
    expect(masterItem?.availableMasters).toBe(1);
    expect(masterItem?.busyMasters).toBe(0);
    expect(masterItem?.nextAvailableSlot).not.toBeNull();
    expect(masterItem?.onlineBookingAvailable).toBe(true);
  });

  it('calculates operational fields for PickMe salons and keeps external fields null', async () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const plusMinutes = (minutes: number) =>
      new Date(now.getTime() + minutes * 60 * 1000);

    const prisma = {
      salon: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'salon-1',
            name: 'Mitte Style Lab',
            country: 'Germany',
            addressLine: 'Testplatz 10',
            city: 'Berlin',
            postalCode: '10115',
            latitude: 52.53,
            longitude: 13.38,
            ratingAverage: 4.8,
            ratingCount: 120,
            phone: '+49000000001',
            isVerified: true,
            services: [],
          },
        ]),
      },
      masterProfile: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      salonMaster: {
        findMany: jest.fn().mockResolvedValue([
          {
            salonId: 'salon-1',
            masterId: 'master-1',
            master: {
              id: 'master-1',
              currentStatus: 'AVAILABLE',
              acceptsBookings: true,
              availableAt: null,
              minutesUntilAvailable: null,
            },
          },
          {
            salonId: 'salon-1',
            masterId: 'master-2',
            master: {
              id: 'master-2',
              currentStatus: 'BUSY',
              acceptsBookings: true,
              availableAt: null,
              minutesUntilAvailable: null,
            },
          },
        ]),
      },
      workingSchedule: {
        findMany: jest.fn().mockResolvedValue([
          {
            masterId: 'master-1',
            dayOfWeek,
            shiftStart: '00:00',
            shiftEnd: '23:59',
            isDayOff: false,
            acceptsBookings: true,
          },
          {
            masterId: 'master-2',
            dayOfWeek,
            shiftStart: '00:00',
            shiftEnd: '23:59',
            isDayOff: false,
            acceptsBookings: true,
          },
        ]),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([
          {
            masterId: 'master-2',
            startsAt: plusMinutes(-10),
            endsAt: plusMinutes(40),
            status: 'inProgress',
          },
        ]),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'service-1',
            salonId: 'salon-1',
            price: '35',
            basePrice: '35',
          },
          {
            id: 'service-2',
            salonId: 'salon-1',
            price: '20',
            basePrice: '20',
          },
        ]),
      },
      masterService: {
        findMany: jest.fn().mockResolvedValue([
          { masterId: 'master-1', service: { salonId: 'salon-1' } },
          { masterId: 'master-2', service: { salonId: 'salon-1' } },
        ]),
      },
    };

    const provider = {
      searchAggregatedNearby: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'external-1',
            source: 'EXTERNAL',
            name: 'External Salon',
            category: 'beauty_salon',
            address: 'Alexanderplatz',
            latitude: 52.54,
            longitude: 13.4,
            rating: 4.4,
            reviewCount: 40,
            openNow: true,
            photoUrl: null,
            externalUrl: 'https://maps.google.com/?cid=1',
            phone: null,
            externalProvider: 'GOOGLE_PLACES',
            externalPlaceId: 'google-1',
            isPickmeConnected: false,
          },
        ],
        diagnostics: {
          provider: 'GOOGLE_PLACES',
          requestsMade: 1,
          rawResults: 1,
          uniqueResults: 1,
          radiusMetersUsed: 5000,
        },
      }),
    };

    const service = new CatalogService(prisma as never, provider as never);

    const result = await service.getNearby({
      latitude: 52.52,
      longitude: 13.405,
      radius: 5000,
      limit: 10,
      category: 'hair_salon',
      query: 'hair salon',
    });

    const pickmeSalon = result.items.find(
      (item) => item.id === 'pickme-salon:salon-1',
    );
    const externalSalon = result.items.find((item) => item.id === 'external-1');

    expect(pickmeSalon).toBeDefined();
    expect(pickmeSalon?.mastersOnShift).toBe(2);
    expect(pickmeSalon?.availableMasters).toBe(1);
    expect(pickmeSalon?.busyMasters).toBe(1);
    expect(pickmeSalon?.minPrice).toBe(20);
    expect(pickmeSalon?.nextAvailableSlot).not.toBeNull();
    expect(pickmeSalon?.onlineBookingAvailable).toBe(true);

    expect(externalSalon).toBeDefined();
    expect(externalSalon?.mastersOnShift).toBeNull();
    expect(externalSalon?.availableMasters).toBeNull();
    expect(externalSalon?.busyMasters).toBeNull();
    expect(externalSalon?.nextAvailableSlot).toBeNull();
    expect(externalSalon?.minPrice).toBeNull();
    expect(externalSalon?.onlineBookingAvailable).toBe(false);

    expect(result.items[0]?.id).toBe('pickme-salon:salon-1');
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });
});

describe('CatalogService.getNearby pagination and provider errors', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('returns PickMe cursor pages from cache and sets hasMore correctly', async () => {
    const prisma = {
      salon: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      masterProfile: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      salonMaster: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      workingSchedule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      masterService: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const provider = {
      searchAggregatedNearby: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'external-1',
            source: 'EXTERNAL',
            name: 'Salon 1',
            category: 'hair_salon',
            address: 'A',
            latitude: 53.3254,
            longitude: 11.4964,
            rating: 4.5,
            reviewCount: 10,
            openNow: true,
            photoUrl: null,
            externalUrl: null,
            phone: null,
            externalProvider: 'GOOGLE_PLACES',
            externalPlaceId: 'gp-1',
            isPickmeConnected: false,
          },
          {
            id: 'external-2',
            source: 'EXTERNAL',
            name: 'Salon 2',
            category: 'hair_salon',
            address: 'B',
            latitude: 53.345,
            longitude: 11.52,
            rating: 4.4,
            reviewCount: 8,
            openNow: true,
            photoUrl: null,
            externalUrl: null,
            phone: null,
            externalProvider: 'GOOGLE_PLACES',
            externalPlaceId: 'gp-2',
            isPickmeConnected: false,
          },
          {
            id: 'external-3',
            source: 'EXTERNAL',
            name: 'Salon 3',
            category: 'hair_salon',
            address: 'C',
            latitude: 53.365,
            longitude: 11.56,
            rating: 4.3,
            reviewCount: 7,
            openNow: false,
            photoUrl: null,
            externalUrl: null,
            phone: null,
            externalProvider: 'GOOGLE_PLACES',
            externalPlaceId: 'gp-3',
            isPickmeConnected: false,
          },
        ],
        diagnostics: {
          provider: 'GOOGLE_PLACES',
          requestsMade: 2,
          rawResults: 3,
          uniqueResults: 3,
          radiusMetersUsed: 15000,
        },
      }),
    };

    const service = new CatalogService(prisma as never, provider as never);

    const page1 = await service.getNearby({
      latitude: 53.3254,
      longitude: 11.4964,
      radius: 15000,
      limit: 2,
      query: 'friseur',
    });

    expect(page1.items).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await service.getNearby({
      latitude: 53.3254,
      longitude: 11.4964,
      radius: 15000,
      limit: 2,
      query: 'friseur',
      cursor: page1.nextCursor ?? undefined,
    });

    expect(page2.items).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
    expect(page2.nextCursor).toBeNull();
    expect(provider.searchAggregatedNearby).toHaveBeenCalledTimes(1);
  });

  it('logs structured google INVALID_ARGUMENT error and does not leak API key', async () => {
    process.env.NODE_ENV = 'development';

    const prisma = {
      salon: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      masterProfile: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      salonMaster: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      workingSchedule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      masterService: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const provider = {
      searchAggregatedNearby: jest.fn().mockRejectedValue(
        new GoogleNearbyApiError(
          400,
          'INVALID_ARGUMENT',
          'Request contains an invalid argument.',
          'req-123',
          'places.id,places.displayName',
        ),
      ),
    };

    const service = new CatalogService(prisma as never, provider as never);
    const errorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);

    try {
      await service.getNearby({
        latitude: 53.3254,
        longitude: 11.4964,
        radius: 15000,
        limit: 20,
        query: 'friseur',
      });
      throw new Error('expected ServiceUnavailableException');
    } catch (error) {
      const response = (error as { response?: { details?: { providerErrorCode?: string } } }).response;
      expect(response?.details?.providerErrorCode).toBe('GOOGLE_INVALID_ARGUMENT');
    }

    const logged = errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('GOOGLE_PLACES');
    expect(logged).toContain('INVALID_ARGUMENT');
    expect(logged).toContain('req-123');
    expect(logged).not.toContain('AIza');
  });
});
