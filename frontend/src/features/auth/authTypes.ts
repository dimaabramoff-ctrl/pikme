export type UserRole = 'CUSTOMER' | 'MASTER' | 'SALON_OWNER' | 'SALON_ADMIN' | 'SUPER_ADMIN'

export interface SalonAdminMembership {
  id: string
  role?: string | null
  isActive?: boolean
  salon?: {
    id: string
    name: string
    slug?: string
  }
}

export interface CurrentUser {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  isActive: boolean
  isVerified: boolean
  customerProfile?: unknown
  masterProfile?: unknown
  salonAdminProfile?: SalonAdminMembership[]
}

export interface LoginPayload {
  emailOrPhone: string
  password: string
}

export interface RegisterCustomerPayload {
  name: string
  email: string
  phone: string
  password: string
  passwordConfirmation: string
}

export interface RegisterMasterPayload extends RegisterCustomerPayload {
  experienceYears: number
  specialization: string
  acceptsHomeVisits: boolean
  independent: boolean
}

export interface RegisterPartnerStaffServicePayload {
  name: string
  category: string
  durationMinutes: number
  price: number
}

export interface RegisterPartnerStaffPayload {
  name: string
  specialization?: string
  experienceYears?: number
  photoUrl?: string
  services: RegisterPartnerStaffServicePayload[]
}

export interface RegisterPartnerPayload {
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  ownerPassword?: string
  ownerPasswordConfirmation?: string
  salonName: string
  salonAddressLine: string
  salonCity: string
  salonPostalCode: string
  salonPhone?: string
  salonCategory?: string
  salonWorkHours?: string
  existingGooglePlaceId?: string
  ownershipConfirmed: boolean
  staff?: RegisterPartnerStaffPayload[]
  activateDemoTrial?: boolean
  demoTrialDays?: number
}

export interface RegisterPartnerResponse {
  success: boolean
  userId: string
  salonId: string
  ownershipStatus: 'UNVERIFIED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED'
  message: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  newPasswordConfirmation: string
}

export interface AuthResponse {
  user: CurrentUser
  accessToken: string
}

export interface ApiErrorResponse {
  statusCode: number
  code: string
  message: string
  details?: unknown
  requestId?: string
}
