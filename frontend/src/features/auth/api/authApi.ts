import { apiClient } from '../../../shared/api/client'
import type {
  AuthResponse,
  ChangePasswordPayload,
  CurrentUser,
  LoginPayload,
  RegisterCustomerPayload,
  RegisterMasterPayload,
  RegisterPartnerPayload,
  RegisterPartnerResponse,
} from '../authTypes'

export const authApi = {
  registerCustomer(payload: RegisterCustomerPayload) {
    return apiClient.request<CurrentUser>('/auth/register/customer', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  registerMaster(payload: RegisterMasterPayload) {
    return apiClient.request<CurrentUser>('/auth/register/master', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  registerPartner(payload: RegisterPartnerPayload) {
    return apiClient.request<RegisterPartnerResponse>('/auth/register/partner', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  login(payload: LoginPayload) {
    return apiClient.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  refresh() {
    return apiClient.request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },

  me() {
    return apiClient.request<CurrentUser>('/auth/me')
  },

  logout() {
    return apiClient.request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },

  logoutAll() {
    return apiClient.request<{ success: boolean }>('/auth/logout-all', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },

  changePassword(payload: ChangePasswordPayload) {
    return apiClient.request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
