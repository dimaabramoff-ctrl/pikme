import { buildEnrichedSalonPayload } from './salon-enrichment';

describe('buildEnrichedSalonPayload', () => {
  it('preserves partner-managed values while filling factual fields from Google', () => {
    const payload = buildEnrichedSalonPayload({
      existingSalon: {
        name: 'Mein Salon',
        addressLine: 'Manuell gepflegte Adresse',
        city: 'Berlin',
        country: 'Deutschland',
        postalCode: '10115',
        latitude: 1.1,
        longitude: 2.2,
        website: 'https://manual.example',
        phone: '030123456',
        ratingAverage: 4.5,
        ratingCount: 10,
      },
      details: {
        externalPlaceId: 'google-123',
        name: 'Google Salon',
        formattedAddress: 'Musterstraße 10, 10115 Berlin, Germany',
        latitude: 11.1,
        longitude: 22.2,
        phone: '+49 30 555555',
        website: 'https://google.example',
        rating: 4.7,
        reviewCount: 77,
        categories: ['hair_salon'],
        photoReferences: ['photo-1'],
        addressComponents: {
          street: 'Musterstraße',
          houseNumber: '10',
          postalCode: '10115',
          city: 'Berlin',
          country: 'Germany',
          countryCode: 'DE',
        },
      },
      factualSnapshot: {
        name: 'Snapshot Name',
        address: 'Snapshot Street',
        city: 'Snapshot City',
        latitude: 3.3,
        longitude: 4.4,
        photo: 'snapshot-photo',
        rating: 4.2,
        reviewCount: 9,
      },
    });

    expect(payload.name).toBe('Mein Salon');
    expect(payload.addressLine).toBe('Manuell gepflegte Adresse');
    expect(payload.city).toBe('Berlin');
    expect(payload.country).toBe('Deutschland');
    expect(payload.postalCode).toBe('10115');
    expect(payload.latitude).toBe(1.1);
    expect(payload.longitude).toBe(2.2);
    expect(payload.phone).toBe('030123456');
    expect(payload.website).toBe('https://manual.example');
    expect(payload.ratingAverage).toBe(4.5);
    expect(payload.ratingCount).toBe(10);
    expect(payload.externalPlaceId).toBe('google-123');
  });

  it('uses Google details when existing salon still has placeholder values', () => {
    const payload = buildEnrichedSalonPayload({
      existingSalon: {
        name: 'Salon ChIJ123',
        addressLine: 'Adresse wird aktualisiert',
        city: 'Unbekannt',
        country: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        website: null,
        phone: null,
        ratingAverage: 0,
        ratingCount: 0,
      },
      details: {
        externalPlaceId: 'google-456',
        name: 'Real Google Salon',
        formattedAddress: 'Testweg 7, 10115 Berlin, Germany',
        latitude: 55.5,
        longitude: 66.6,
        phone: '+49 30 111111',
        website: 'https://real.example',
        rating: 4.9,
        reviewCount: 321,
        categories: ['beauty_salon'],
        photoReferences: ['photo-2'],
        addressComponents: {
          street: 'Testweg',
          houseNumber: '7',
          postalCode: '10115',
          city: 'Berlin',
          country: 'Germany',
          countryCode: 'DE',
        },
      },
      factualSnapshot: {
        name: 'Snapshot Name',
        address: 'Snapshot Street',
        city: 'Snapshot City',
        latitude: 3.3,
        longitude: 4.4,
        photo: 'snapshot-photo',
        rating: 4.2,
        reviewCount: 9,
      },
    });

    expect(payload.name).toBe('Real Google Salon');
    expect(payload.addressLine).toBe('Testweg 7');
    expect(payload.city).toBe('Berlin');
    expect(payload.postalCode).toBe('10115');
    expect(payload.country).toBe('Germany');
    expect(payload.latitude).toBe(55.5);
    expect(payload.longitude).toBe(66.6);
    expect(payload.phone).toBe('+49 30 111111');
    expect(payload.website).toBe('https://real.example');
    expect(payload.ratingAverage).toBe(4.9);
    expect(payload.ratingCount).toBe(321);
    expect(payload.externalPlaceId).toBe('google-456');
  });
});
