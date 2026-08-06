import { useMutation, useQuery } from '@tanstack/react-query';
import { businessClaimsApi, businessAccessCodesApi } from './api';
import type { CreateBusinessClaimDto, RequestTrialDto, RedeemCodeDto } from './api';
import { useAuthStore } from '../auth/authStore';
import { apiClient } from '../../shared/api/client';
import type { CurrentUser } from '../auth/authTypes';

export const useCreateBusinessClaim = () => {
  return useMutation({
    mutationFn: (dto: CreateBusinessClaimDto) =>
      businessClaimsApi.createClaim(dto),
  });
};

export const useActivateTrialDirect = () => {
  return useMutation({
    mutationFn: (claimId: string) =>
      businessClaimsApi.activateTrialDirect(claimId),
  });
};

export const useRequestTrial = () => {
  return useMutation({
    mutationFn: ({ claimId, dto }: { claimId: string; dto: RequestTrialDto }) =>
      businessClaimsApi.requestTrial(claimId, dto),
  });
};

export const useMyBusinesses = () => {
  return useQuery({
    queryKey: ['business-claims', 'me'],
    queryFn: () => businessClaimsApi.getMyBusinesses(),
  });
};

export const useAllClaimsAdmin = () => {
  return useQuery({
    queryKey: ['business-claims', 'admin-all'],
    queryFn: () => businessClaimsApi.getAllClaimsAdmin(),
  });
};

export const useRedeemCode = () => {
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  return useMutation({
    mutationFn: (dto: RedeemCodeDto) =>
      businessAccessCodesApi.redeemCode(dto),
    onSuccess: async (res) => {
      const r = res as { accessToken?: string } | null;
      if (r?.accessToken) {
        setAccessToken(r.accessToken);
      }
      try {
        const updated = await apiClient.request<CurrentUser>('/auth/me');
        setCurrentUser(updated);
      } catch {
        // non-critical
      }
    },
  });
};
