import { apiClient } from '../../../shared/api/client'

export type AdminVoucherType = 'PARTNER_DAY' | 'PARTNER_MONTH' | 'PARTNER_YEAR' | 'PROMO_TRIAL'

export interface CreateAdminVoucherPayload {
  type: AdminVoucherType
  durationDays?: number
  maxRedemptions?: number
  assignedSalonId?: string
  validFrom?: string
  expiresAt?: string
  comment?: string
}

export interface CreateAdminVoucherResponse {
  id: string
  fullCode: string
  type: string
  displayAccessType?: string
  maxRedemptions: number
  expiresAt?: string | null
  warning: string
}

export interface RedeemVoucherPayload {
  code: string
  salonId?: string
}

export interface RedeemVoucherResponse {
  success: boolean
  redemptionId: string
  type: string
  accessType?: string
  subscription?: {
    plan: string
    startsAt: string
    endsAt: string
    status: string
    durationDays?: number
  } | null
  activatedFeatures?: string[]
}

function mapVoucherType(input: CreateAdminVoucherPayload) {
  if (input.type === 'PARTNER_DAY') {
    return {
      type: 'PROMO_TRIAL',
      durationDays: 1,
    }
  }

  if (input.type === 'PARTNER_MONTH') {
    return {
      type: 'PARTNER_MONTH',
      durationDays: 30,
    }
  }

  if (input.type === 'PARTNER_YEAR') {
    return {
      type: 'PARTNER_YEAR',
      durationDays: 365,
    }
  }

  return {
    type: 'PROMO_TRIAL',
    durationDays: input.durationDays ?? 14,
  }
}

export const voucherApi = {
  createOne: (payload: CreateAdminVoucherPayload) => {
    const mapped = mapVoucherType(payload)
    return apiClient.request<CreateAdminVoucherResponse>('/vouchers/generate', {
      method: 'POST',
      body: JSON.stringify({
        type: mapped.type,
        durationDays: mapped.durationDays,
        maxRedemptions: payload.maxRedemptions ?? 1,
        assignedSalonId: payload.assignedSalonId,
        validFrom: payload.validFrom,
        expiresAt: payload.expiresAt,
        metadata: payload.comment ? { adminComment: payload.comment } : undefined,
      }),
    })
  },

  redeem: (payload: RedeemVoucherPayload) =>
    apiClient.request<RedeemVoucherResponse>('/vouchers/redeem', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  revoke: (voucherId: string) =>
    apiClient.request<{ success: boolean }>(`/vouchers/${voucherId}/revoke`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    }),

  list: () =>
    apiClient.request<Array<{
      id: string
      codePreview: string
      type: string
      status: string
      durationDays: number | null
      redemptionCount: number
      maxRedemptions: number
      expiresAt: string | null
      createdAt: string
    }>>('/vouchers', {
      method: 'GET',
    }),
}
