export interface SalonSummary {
  id: string
  name: string
  description?: string | null
  city: string
  postalCode: string
  ratingAverage: number
  reviewCount: number
  homeVisitEnabled: boolean
  slug?: string
}

export interface MasterSummary {
  id: string
  displayName: string
  specialization?: string | null
  biography?: string | null
  experienceYears?: number
  ratingAverage?: number | null
  reviewCount?: number
  acceptsHomeVisits: boolean
  salon?: {
    id: string
    name: string
  } | null
}

export interface ServiceSummary {
  id: string
  name: string
  description?: string | null
  category: string
  basePrice: number
  durationMinutes: number
  availableInSalon?: boolean
  availableAtHome?: boolean
  isActive?: boolean
}

export interface ReviewSummary {
  id: string
  rating: number
  comment?: string | null
  createdAt: string
}

export interface FavoritesResponse {
  salons: SalonSummary[]
  masters: MasterSummary[]
}

export interface ListResponse<T> {
  items: T[]
  total: number
}

export interface ServiceListResponse {
  items: ServiceSummary[]
}

export type SalonMasterListItem =
  | MasterSummary
  | {
      id: string
      displayName?: string
      master?: MasterSummary | null
    }
