/**
 * Vendor activation hooks (P7.8) — list vendors and toggle enabled state.
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useSessionStore } from "@/stores/session";
import { toVendorList, type VendorListView } from "@/lib/admin-vendors";
import type { ToggleVendorReq, ToggleVendorRes } from "@/types/api";

const listKey = ["admin", "vendors"] as const;

export function useAdminVendors() {
  const token = useSessionStore((s) => s.token);

  return useQuery<VendorListView>({
    queryKey: listKey,
    queryFn: async () => {
      const res = await adminApi.listVendors();
      return toVendorList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useToggleVendor() {
  const qc = useQueryClient();
  const invalidate = useCallback(
    () => void qc.invalidateQueries({ queryKey: listKey }),
    [qc]
  );

  return useMutation<ToggleVendorRes, unknown, ToggleVendorReq>({
    mutationFn: (req) => adminApi.toggleVendor(req),
    onSettled: invalidate,
  });
}
