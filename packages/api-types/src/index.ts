export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface RealtimeEvent<T> {
  id: string;
  type: string;
  occurredAt: string;
  version: number;
  data: T;
}

export interface NearbyOperationalFields {
  mastersOnShift: number | null;
  availableMasters: number | null;
  busyMasters: number | null;
  nextAvailableSlot: string | null;
  minPrice: number | null;
  onlineBookingAvailable: boolean;
}

export interface NearbyCatalogItem extends NearbyOperationalFields {
  id: string;
  source: 'PICKME' | 'EXTERNAL';
  externalProvider?: string | null;
  externalPlaceId?: string | null;
  name: string;
  category?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  openNow?: boolean | null;
  photoUrl?: string | null;
  externalUrl?: string | null;
  phone?: string | null;
  isPickmeConnected: boolean;
  isBookable?: boolean | null;
  isVerified?: boolean | null;
}
