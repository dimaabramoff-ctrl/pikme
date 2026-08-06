import type { GooglePlaceDetails } from '../catalog-providers/external-places.provider';

export interface FactualSnapshot {
  name?: string;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  photo?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
}

interface ExistingSalonLike {
  name?: string | null;
  addressLine?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  phone?: string | null;
  ratingAverage?: number | null;
  ratingCount?: number | null;
}

function isPlaceholderValue(value: string | null | undefined) {
  if (!value) return true;
  const normalized = value.trim();
  return (
    normalized === '' ||
    normalized === 'Adresse wird aktualisiert' ||
    normalized === 'Unbekannt' ||
    /^Salon\s+ChI[a-zA-Z0-9_-]+$/i.test(normalized)
  );
}

function buildAddressLine(details: GooglePlaceDetails) {
  const parts = [details.addressComponents.street, details.addressComponents.houseNumber].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return details.formattedAddress ?? null;
}

export function buildEnrichedSalonPayload(args: {
  existingSalon: ExistingSalonLike;
  details: GooglePlaceDetails;
  factualSnapshot?: FactualSnapshot;
}) {
  const { existingSalon, details, factualSnapshot } = args;

  const shouldPreserveExisting = (value: string | null | undefined) => !isPlaceholderValue(value);

  return {
    name: shouldPreserveExisting(existingSalon.name) ? existingSalon.name : details.name ?? factualSnapshot?.name ?? existingSalon.name,
    addressLine: shouldPreserveExisting(existingSalon.addressLine) ? existingSalon.addressLine : buildAddressLine(details) ?? factualSnapshot?.address ?? existingSalon.addressLine,
    city: shouldPreserveExisting(existingSalon.city) ? existingSalon.city : details.addressComponents.city ?? factualSnapshot?.city ?? existingSalon.city,
    country: shouldPreserveExisting(existingSalon.country) ? existingSalon.country : details.addressComponents.country ?? existingSalon.country,
    postalCode: shouldPreserveExisting(existingSalon.postalCode) ? existingSalon.postalCode : details.addressComponents.postalCode ?? existingSalon.postalCode,
    latitude: existingSalon.latitude ?? details.latitude ?? factualSnapshot?.latitude ?? null,
    longitude: existingSalon.longitude ?? details.longitude ?? factualSnapshot?.longitude ?? null,
    phone: existingSalon.phone ?? details.phone ?? null,
    website: existingSalon.website ?? details.website ?? null,
    ratingAverage: existingSalon.ratingAverage && existingSalon.ratingAverage > 0 ? existingSalon.ratingAverage : (details.rating ?? factualSnapshot?.rating ?? existingSalon.ratingAverage),
    ratingCount: existingSalon.ratingCount && existingSalon.ratingCount > 0 ? existingSalon.ratingCount : (details.reviewCount ?? factualSnapshot?.reviewCount ?? existingSalon.ratingCount),
    externalProvider: 'GOOGLE_PLACES' as const,
    externalPlaceId: details.externalPlaceId,
  };
}
