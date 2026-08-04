export interface CatalogSearchResult {
  id: string;
  source: 'PICKME' | 'EXTERNAL';
  name: string;
  category?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  openNow?: boolean | null;
  photoUrl?: string | null;
  externalUrl?: string | null;
  phone?: string | null;
  externalProvider?: string | null;
  externalPlaceId?: string | null;
  isPickmeConnected: boolean;
  mastersOnShift?: number | null;
  availableMasters?: number | null;
  busyMasters?: number | null;
  nextAvailableSlot?: string | null;
  minPrice?: number | null;
  onlineBookingAvailable?: boolean;
}

export class CatalogProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogProviderConfigurationError';
  }
}

export interface CatalogProvider {
  search(
    query: string,
    options?: {
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      category?: string;
      limit?: number;
    },
  ): Promise<CatalogSearchResult[]>;
}
