/**
 * Recon hooks (P7.10) — payout reconciliation, provider float, deposit monitor.
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useSessionStore } from "@/stores/session";
import {
  toPayoutMismatchesList,
  toProviderBalanceList,
  toDepositTransactionsList,
  type PayoutMismatchView,
  type ProviderBalanceView,
  type DepositTransactionView,
} from "@/lib/admin-recon";

const payoutsKey = ["admin", "payout-mismatches"] as const;
const providersKey = ["admin", "provider-balance"] as const;
const depositsKey = ["admin", "transactions"] as const;

export function useAdminPayoutMismatches() {
  const token = useSessionStore((s) => s.token);

  return useQuery<PayoutMismatchView[]>({
    queryKey: payoutsKey,
    queryFn: async () => {
      const res = await adminApi.listPayoutMismatches();
      return toPayoutMismatchesList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useTriggerPayoutReconciliation() {
  const qc = useQueryClient();
  const invalidate = useCallback(
    () => void qc.invalidateQueries({ queryKey: payoutsKey }),
    [qc]
  );

  return useMutation<unknown, unknown, void>({
    mutationFn: () => adminApi.reconcilePayouts(),
    onSettled: invalidate,
  });
}

export function useAdminProviderBalance() {
  const token = useSessionStore((s) => s.token);

  return useQuery<ProviderBalanceView[]>({
    queryKey: providersKey,
    queryFn: async () => {
      const res = await adminApi.getProviderBalance();
      return toProviderBalanceList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useAdminDeposits(params?: { status?: string; page?: number; limit?: number }) {
  const token = useSessionStore((s) => s.token);

  return useQuery<{ transactions: DepositTransactionView[]; total: number }>({
    queryKey: [...depositsKey, ...(params ? [params.status, params.page, params.limit] : [])],
    queryFn: async () => {
      const res = await adminApi.listDeposits(params);
      return toDepositTransactionsList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
