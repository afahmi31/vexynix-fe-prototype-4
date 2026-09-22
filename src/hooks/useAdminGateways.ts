/**
 * Payment gateways hooks (P7.6) — list, create, update.
 *
 * Edit invalidates the list so the UI refreshes with new config (per spec,
 * "edit a provider → next deposit routes with new config without restart").
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useSessionStore } from "@/stores/session";
import { toGatewayList, type GatewayListView } from "@/lib/admin-gateways";
import type { CreateProviderReq, UpdateProviderReq } from "@/types/api";

const listKey = ["admin", "gateways"] as const;

export function useAdminGateways() {
  const token = useSessionStore((s) => s.token);

  return useQuery<GatewayListView>({
    queryKey: listKey,
    queryFn: async () => {
      const res = await adminApi.listProviders();
      return toGatewayList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useCreateGateway() {
  const qc = useQueryClient();
  const invalidate = useCallback(
    () => void qc.invalidateQueries({ queryKey: listKey }),
    [qc]
  );

  return useMutation<unknown, unknown, CreateProviderReq>({
    mutationFn: (req) => adminApi.createProvider(req),
    onSettled: invalidate,
  });
}

export function useUpdateGateway() {
  const qc = useQueryClient();
  const invalidate = useCallback(
    () => void qc.invalidateQueries({ queryKey: listKey }),
    [qc]
  );

  return useMutation<unknown, unknown, { id: string; req: UpdateProviderReq }>({
    mutationFn: ({ id, req }) => adminApi.updateProvider(id, req),
    onSettled: invalidate,
  });
}
