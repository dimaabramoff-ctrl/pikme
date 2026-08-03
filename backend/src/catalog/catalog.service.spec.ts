import { mergeNearbyResults } from './catalog.service';

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
          sourceType: 'PICKME' as const,
          isBookable: true,
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
          sourceType: 'EXTERNAL' as const,
          externalProvider: 'GOOGLE_PLACES',
          externalPlaceId: 'place-1',
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
          sourceType: 'PICKME' as const,
          isBookable: true,
        },
        {
          id: 'pickme-2',
          name: 'Private Master',
          category: 'barber',
          address: 'Hauptstrasse 5, Berlin',
          latitude: 52.54,
          longitude: 13.39,
          sourceType: 'PICKME' as const,
          isBookable: false,
          isPrivate: true,
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
          sourceType: 'EXTERNAL' as const,
          externalProvider: 'GOOGLE_PLACES',
          externalPlaceId: 'place-1',
        },
        {
          id: 'external-2',
          name: 'Another Nearby Salon',
          category: 'beauty_salon',
          address: 'Neue Schönhauser Strasse 2, Berlin',
          latitude: 52.55,
          longitude: 13.4,
          sourceType: 'EXTERNAL' as const,
          externalProvider: 'GOOGLE_PLACES',
          externalPlaceId: 'place-2',
        },
      ],
    );

    expect(merged.map((item) => item.id)).toEqual([
      'pickme-1',
      'pickme-2',
      'external-2',
    ]);
    expect(merged[0].sourceType).toBe('PICKME');
    expect(merged[2].sourceType).toBe('EXTERNAL');
    expect(merged.every((item) => item.name)).toBe(true);
  });
});
