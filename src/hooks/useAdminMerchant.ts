/**
 * Merchant self-service hooks (P7.9) — profile, domains, password change,
 * audit trail.
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useSessionStore } from "@/stores/session";
import {
  toMerchantAuditList,
  toMerchantDomainList,
  toMerchantProfile,
  type MerchantProfileView,
} from "@/lib/admin-merchant";
import type {
  AddMerchantDomainReq,
  MerchantDomain,
  MerchantPasswordReq,
  MerchantProfileReq,
  VerifyMerchantDomainReq,
} from "@/types/api";

const profileKey = ["admin", "merchant", "profile"] as const;
const domainsKey = ["admin", "merchant", "domains"] as const;
const auditKey = ["admin", "merchant", "audit"] as const;

export function useAdminMerchantProfile() {
  const token = useSessionStore((s) => s.token);

  return useQuery<MerchantProfileView>({
    queryKey: profileKey,
    queryFn: async () => {
      const res = await adminApi.getMerchantProfile();
      return toMerchantProfile(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useUpdateMerchantProfile() {
  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: profileKey });
    void qc.invalidateQueries({ queryKey: domainsKey });
    void qc.invalidateQueries({ queryKey: auditKey });
  }, [qc]);

  return useMutation<unknown, unknown, MerchantProfileReq>({
    mutationFn: (req) => adminApi.updateMerchantProfile(req),
    onSettled: invalidate,
  });
}

export function useAdminMerchantDomains() {
  const token = useSessionStore((s) => s.token);

  return useQuery<ReturnType<typeof toMerchantDomainList>>({
    queryKey: domainsKey,
    queryFn: async () => {
      const res = await adminApi.getMerchantProfile();
      // Access raw response to get domains array
      const raw = res as unknown as Record<string, unknown>;
      return toMerchantDomainList(raw?.domains as MerchantDomain[] | undefined);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useAddMerchantDomain() {
  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: domainsKey });
    void qc.invalidateQueries({ queryKey: profileKey });
  }, [qc]);

  return useMutation<unknown, unknown, AddMerchantDomainReq>({
    mutationFn: (req) => adminApi.addMerchantDomain(req),
    onSettled: invalidate,
  });
}

export function useVerifyMerchantDomain() {
  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: domainsKey });
    void qc.invalidateQueries({ queryKey: profileKey });
  }, [qc]);

  return useMutation<unknown, unknown, VerifyMerchantDomainReq>({
    mutationFn: (req) => adminApi.verifyMerchantDomain(req),
    onSettled: invalidate,
  });
}

export function useChangeMerchantPassword() {
  return useMutation<unknown, unknown, MerchantPasswordReq>({
    mutationFn: (req) => adminApi.changeMerchantPassword(req),
  });
}

export function useAdminMerchantAudit() {
  const token = useSessionStore((s) => s.token);

  return useQuery<ReturnType<typeof toMerchantAuditList>>({
    queryKey: auditKey,
    queryFn: async () => {
      const res = await adminApi.getMerchantAudit();
      return toMerchantAuditList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
