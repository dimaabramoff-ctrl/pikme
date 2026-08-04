import { CatalogService, mergeNearbyResults } from './catalog.service';

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
      search: jest.fn().mockResolvedValue([
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
      ]),
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

    const pickmeSalon = result.find(
      (item) => item.id === 'pickme-salon:salon-1',
    );
    const externalSalon = result.find((item) => item.id === 'external-1');

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

    expect(result[0]?.id).toBe('pickme-salon:salon-1');
  });
});
