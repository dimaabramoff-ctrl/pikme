export interface SalonSummary {
  id: string
  name: string
  description?: string | null
  sourceType?: 'PICKME' | 'EXTERNAL'
  addressLine?: string
  addressLine1?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  latitude?: number | null
  longitude?: number | null
  isVerified?: boolean
  city: string
  postalCode: string
  ratingAverage: number
  reviewCount: number
  homeVisitEnabled: boolean
  slug?: string
  openingHoursJson?: unknown
  cancellationPolicyJson?: unknown
  photos?: Array<{
    id: string
    imageUrl: string
    sortOrder?: number
  }>
  services?: ServiceSummary[]
  masters?: Array<{
    id: string
    masterId: string
    master?: MasterSummary | null
  }>
}

export interface MasterSummary {
  id: string
  displayName: string
  currentStatus?: 'AVAILABLE' | 'SOON_AVAILABLE' | 'BUSY' | 'OFFLINE'
  availableAt?: string | null
  minutesUntilAvailable?: number | null
  specialization?: string | null
  biography?: string | null
  experienceYears?: number
  ratingAverage?: number | null
  reviewCount?: number
  acceptsHomeVisits: boolean
  photoUrl?: string | null
  services?: Array<{
    id: string
    name: string
  }>
  salon?: {
    id: string
    name: string
  } | null
  profileFlags?: {
    isDemoProfile?: boolean
    isIndependentProvider?: boolean
    labels?: string[]
    profileKind?: string | null
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

export interface BookingSlotItem {
  startsAt: string
  availableMasterIds: string[]
}

export interface BookingSlotsResponse {
  salonId: string
  serviceId: string
  durationMinutes: number
  date: string
  slots: BookingSlotItem[]
}

export interface CreateBookingPayload {
  salonId: string
  serviceId: string
  startsAt: string
  masterId?: string
  paymentMethod?: 'IN_SALON' | 'CARD'
  items?: Array<{
    serviceId: string
    quantity: number
    modifierOptionIds?: string[]
  }>
  additionalWish?: string
}

export interface BookingQuotePayload {
  salonId: string
  items: Array<{
    serviceId: string
    quantity: number
    modifierOptionIds?: string[]
  }>
}

export interface BookingQuoteLine {
  serviceId: string
  serviceName: string
  quantity: number
  basePrice: number
  baseDurationMinutes: number
  modifierOptionIds: string[]
  modifierPrice: number
  modifierDurationMinutes: number
  totalPrice: number
  totalDurationMinutes: number
}

export interface BookingQuoteResponse {
  salonId: string
  items: BookingQuoteLine[]
  totalPrice: number
  totalDurationMinutes: number
  currency: string
  additionalWish: string | null
}

export interface BookingSummary {
  id: string
  customerProfileId: string
  masterId: string
  salonId?: string | null
  serviceId: string
  status: string
  startsAt: string
  endsAt: string
  totalPrice: string
  currency: string
}

export interface SalonPartnerBookingSummary {
  id: string
  bookingNumber: string
  customerName: string
  customerPhone: string
  serviceName: string
  masterName: string
  startsAt: string
  totalPrice: string
  currency: string
  status: string
  paymentStatus: string
  customerComment: string | null
}

export interface ReviewSummary {
  id: string
  rating: number
  text?: string | null
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

export type EditorPaymentMethod = 'IN_SALON' | 'CARD'

export interface SalonEditorOverview {
  name: string
  businessType: string
  tagline: string
  description: string
  phone: string
  email: string
  website: string
  addressLine: string
  city: string
  postalCode: string
  openingHoursText: string
  languages: string[]
  amenities: string[]
  parking: string
  accessibility: string
  paymentMethods: EditorPaymentMethod[]
  bookingConfirmationMode?: 'AUTO' | 'REQUEST'
  foundedYear?: number | null
}

export interface SalonEditorMoreInfo {
  about: string
  history: string
  serviceDirections: string[]
  rules: string[]
  teamNote: string
}

export interface SalonEditorScheduleBreak {
  startTime: string
  endTime: string
  reason?: string
}

export interface SalonEditorScheduleRow {
  dayOfWeek: number
  shiftStart: string
  shiftEnd: string
  isDayOff?: boolean
  acceptsBookings?: boolean
  acceptsUrgentBookings?: boolean
  supportsHomeVisits?: boolean
  breaks?: SalonEditorScheduleBreak[]
}

export interface SalonEditorServiceItem {
  id?: string
  name: string
  description?: string
  category: string
  basePrice: number
  durationMinutes: number
  availableInSalon?: boolean
  availableAtHome?: boolean
  isActive?: boolean
}

export interface SalonEditorStaffItem {
  id?: string
  displayName: string
  specialization?: string
  biography?: string
  experienceYears?: number
  acceptsHomeVisits?: boolean
  currentStatus?: 'AVAILABLE' | 'SOON_AVAILABLE' | 'BUSY' | 'OFFLINE'
  avatarUrl?: string
  serviceIds: string[]
  schedules: SalonEditorScheduleRow[]
}

export interface SalonEditorPhotoItem {
  id?: string
  imageUrl: string
  sortOrder: number
}

export interface SalonEditorDraftPayload {
  overview: SalonEditorOverview
  moreInfo: SalonEditorMoreInfo
  services: SalonEditorServiceItem[]
  staff: SalonEditorStaffItem[]
  photos: SalonEditorPhotoItem[]
  coverPhotoId?: string | null
  googleCoverUrl?: string | null
}

export interface SalonEditorPublishedPayload {
  overview: SalonEditorOverview
  moreInfo: SalonEditorMoreInfo
  coverPhotoId?: string | null
  googleCoverUrl?: string | null
  publishedAt: string
}

export interface SalonEditorStateResponse {
  salonId: string
  draft: SalonEditorDraftPayload
  published: SalonEditorPublishedPayload
  validationIssues: string[]
  updatedAt: string
  publishedAt: string
}

export interface SalonEditorDraftSaveResponse {
  salonId: string
  draft: SalonEditorDraftPayload
  validationIssues: string[]
}

export interface SalonEditorPublishResponse {
  salonId: string
  publishedAt?: string
  draft: SalonEditorDraftPayload
  publicSalon: SalonSummary
}

export type SalonMasterListItem =
  | MasterSummary
  | {
      id: string
      displayName?: string
      master?: MasterSummary | null
    }
