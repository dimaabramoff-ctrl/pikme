export type UserRole = 'CUSTOMER' | 'MASTER' | 'SALON_ADMIN' | 'SUPER_ADMIN'

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
  salonAdminProfile?: unknown
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
