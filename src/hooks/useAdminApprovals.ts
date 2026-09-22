/**
 * Withdrawal approvals hooks (P7.4) — the two actionable queues
 * (PENDING_APPROVAL and AML_HOLD) + row actions.
 *
 * Approve and AML-resolve are step-up-fresh endpoints: on 401
 * STEP_UP_REQUIRED apiFetch opens the P4.1 modal and retries automatically.
 * Concurrent-approve: the backend refuses a second approve with a 4xx
 * (state CAS) — mapApprovalActionError turns that into "already processed"
 * and the mutation invalidates the queue so it refreshes.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useSessionStore } from "@/stores/session";
import { toWithdrawalQueue, type WithdrawalQueueView } from "@/lib/admin-approvals";
import type { ResolveAmlReq } from "@/types/api";

const QUEUE_KEY = ["admin", "withdrawal-queue"] as const;

/** Fetch one approvals queue by status. */
export function useWithdrawalQueue(status: "PENDING_APPROVAL" | "AML_HOLD") {
  const token = useSessionStore((s) => s.token);

  return useQuery<WithdrawalQueueView>({
    queryKey: [...QUEUE_KEY, status],
    queryFn: async () => {
      const res = await adminApi.listWithdrawals(status);
      return toWithdrawalQueue(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
function useInvalidateQueues() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: QUEUE_KEY });
}

/** POST /v1/withdrawals/:id/approve (step-up-fresh). */
export function useApproveWithdrawal() {
  const invalidate = useInvalidateQueues();
  return useMutation({
    mutationFn: (id: string) => adminApi.approveWithdrawal(id),
    // Refetch on success AND on CAS-refusal — either way the queue changed.
    onSettled: invalidate,
  });
}

/** POST /v1/withdrawals/:id/aml (step-up-fresh). */
export function useResolveAml() {
  const invalidate = useInvalidateQueues();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResolveAmlReq }) =>
      adminApi.resolveAml(id, body),
    onSettled: invalidate,
  });
}
