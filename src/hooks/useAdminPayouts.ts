/**
 * Operator payouts hooks (P7.5) — earnings card, history table, propose form,
 * approve action, and result entry.
 *
 * Propose and approve are step-up-fresh endpoints: on 401 STEP_UP_REQUIRED
 * apiFetch opens the P4.1 modal and retries automatically.
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useSessionStore } from "@/stores/session";
import {
  toEarningsView,
  toPayoutHistory,
  toPayoutDetail,
  type EarningsView,
  type PayoutHistoryView,
} from "@/lib/admin-payouts";
import type { ProposeOperatorPayoutReq, CreateOperatorPayoutRes, OperatorPayoutCallbackReq } from "@/types/api";

const earningsKey = ["admin", "payouts-earnings"] as const;
const historyKey = ["admin", "payouts-history"] as const;
const detailKey = (id: string) => ["admin", "payout-detail", id] as const;

// ---------------------------------------------------------------------------
// Earnings card
// ---------------------------------------------------------------------------

export function useOperatorEarnings() {
  const token = useSessionStore((s) => s.token);

  return useQuery<EarningsView>({
    queryKey: earningsKey,
    queryFn: async () => {
      const res = await adminApi.operatorEarnings();
      return toEarningsView(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// ---------------------------------------------------------------------------
// History list
// ---------------------------------------------------------------------------

export function usePayoutHistory() {
  const token = useSessionStore((s) => s.token);

  return useQuery<PayoutHistoryView>({
    queryKey: historyKey,
    queryFn: async () => {
      const res = await adminApi.listOperatorPayouts();
      return toPayoutHistory(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// ---------------------------------------------------------------------------
// Detail view (optional drawer/expansion)
// ---------------------------------------------------------------------------

export function usePayoutDetail(id: string | null) {
  const token = useSessionStore((s) => s.token);

  return useQuery({
    queryKey: detailKey(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const res = await adminApi.getOperatorPayout(id);
      return toPayoutDetail(res);
    },
    enabled: !!token && !!id,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// ---------------------------------------------------------------------------
// Form actions (propose + approve + callback)
// ---------------------------------------------------------------------------

function useInvalidatePayoutQueries() {
  const qc = useQueryClient();
  return useCallback(() => {
    // Invalidate history and detail queries
    void qc.invalidateQueries({ queryKey: historyKey });
    void qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "admin" && q.queryKey[1] === "payout-detail" });
    // Also refresh earnings (balance may change)
    void qc.invalidateQueries({ queryKey: earningsKey });
  }, [qc]);
}

export function useProposeOperatorPayout() {
  const invalidate = useInvalidatePayoutQueries();
  return useMutation<CreateOperatorPayoutRes, unknown, ProposeOperatorPayoutReq>({
    mutationFn: (req) => adminApi.proposeOperatorPayout(req),
    onSettled: invalidate,
  });
}

export function useApproveOperatorPayout() {
  const invalidate = useInvalidatePayoutQueries();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => adminApi.approveOperatorPayout(id),
    onSettled: invalidate,
  });
}

export function useOperatorPayoutCallback() {
  const invalidate = useInvalidatePayoutQueries();
  return useMutation<void, unknown, { id: string; req: OperatorPayoutCallbackReq }>({
    mutationFn: ({ id, req }) => adminApi.operatorPayoutCallback(id, req),
    onSettled: invalidate,
  });
}
