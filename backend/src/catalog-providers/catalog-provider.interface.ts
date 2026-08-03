export interface CatalogSearchResult {
  id: string;
  name: string;
  category?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  openingStatus?: string | null;
  photoReference?: string | null;
  phone?: string | null;
  sourceType: 'PICKME' | 'EXTERNAL';
  externalProvider?: string | null;
  externalPlaceId?: string | null;
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
