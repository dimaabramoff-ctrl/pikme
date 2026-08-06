import { apiClient } from '../../shared/api/client';

export interface CreateBusinessClaimDto {
  salonId?: string;
  googlePlaceId?: string;
  factualSnapshot?: {
    name?: string;
    address?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
    photo?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
  };
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  preferredContactMethod?: string;
  verificationMethod?: string;
  message?: string;
}

export interface RequestTrialDto {
  email: string;
  phone?: string;
  role?: string;
}

export interface RedeemCodeDto {
  code: string;
  salonId?: string;
  googlePlaceId?: string;
  factualSnapshot?: {
    name?: string;
    address?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
    photo?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
  };
}

export interface BusinessClaimSummary {
  id: string;
  status: string;
  verificationLevel: string;
  createdAt: string;
  activatedAt?: string | null;
  googlePlaceId?: string | null;
  metadata?: Record<string, unknown> | null;
  salon?: {
    id: string;
    name: string;
    addressLine?: string;
    city?: string;
  } | null;
}

export interface ActivateTrialResult {
  subscriptionId: string;
  salonId: string;
  trialEndsAt: string;
  trialDays: number;
  businessName?: string | null;
}

export const businessClaimsApi = {
  createClaim: (dto: CreateBusinessClaimDto) =>
    apiClient.request<BusinessClaimSummary>('/business-claims', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  getMyBusinesses: () =>
    apiClient.request<BusinessClaimSummary[]>('/business-claims/me'),

  getBusinessClaim: (claimId: string) =>
    apiClient.request<BusinessClaimSummary>(`/business-claims/${claimId}`),

  activateTrialDirect: (claimId: string) =>
    apiClient.request<ActivateTrialResult>(`/business-claims/${claimId}/activate-trial`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  requestTrial: (claimId: string, dto: RequestTrialDto) =>
    apiClient.request(`/business-claims/${claimId}/request-trial`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  getAllClaimsAdmin: () =>
    apiClient.request<BusinessClaimSummary[]>('/business-claims/admin/all'),
};

export const businessAccessCodesApi = {
  redeemCode: (dto: RedeemCodeDto) =>
    apiClient.request('/business-access-codes/redeem', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  listCodes: () =>
    apiClient.request('/business-access-codes/list'),
};
