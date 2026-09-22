/**
 * Currencies & FX hooks (P7.7) — list/upsert, rate entry, and conversion preview.
 *
 * Rate entry (POST /v1/admin/fx-rates) is effective-dated, not retroactive.
 * Convert preview (GET /v1/admin/fx/convert) is debounced client-side for UX.
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useSessionStore } from "@/stores/session";
import {
  toCurrencyList,
  toFXRateList,
  toFXConvertView,
  type CurrencyListView,
  type FXRateListView,
  type FXConvertView,
} from "@/lib/admin-currencies";
import type { UpsertCurrencyReq, SetFXRateReq } from "@/types/api";

const listKey = ["admin", "currencies"] as const;
const fxRatesKey = ["admin", "fx-rates"] as const;

export function useAdminCurrencies() {
  const token = useSessionStore((s) => s.token);

  return useQuery<CurrencyListView>({
    queryKey: listKey,
    queryFn: async () => {
      const res = await adminApi.listCurrencies();
      return toCurrencyList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useUpsertCurrency() {
  const qc = useQueryClient();
  const invalidate = useCallback(
    () => void qc.invalidateQueries({ queryKey: listKey }),
    [qc]
  );

  return useMutation<unknown, unknown, UpsertCurrencyReq>({
    mutationFn: (req) => adminApi.upsertCurrency(req),
    onSettled: invalidate,
  });
}

export function useAdminFXRates() {
  const token = useSessionStore((s) => s.token);

  return useQuery<FXRateListView>({
    queryKey: fxRatesKey,
    queryFn: async () => {
      const res = await adminApi.listFXRates();
      return toFXRateList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useSetFXRate() {
  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: fxRatesKey });
    void qc.invalidateQueries({ queryKey: listKey }); // Also refresh currencies if rates imply changes
  }, [qc]);

  return useMutation<unknown, unknown, SetFXRateReq>({
    mutationFn: (req) => adminApi.setFXRate(req),
    onSettled: invalidate,
  });
}

export function useFXConvertPreview() {
  return useMutation<FXConvertView, unknown, { from: string; to: string; amount: number }>({
    mutationFn: async ({ from, to, amount }) => {
      const res = await adminApi.convertFX(from, to, amount);
      return toFXConvertView(res);
    },
    // No invalidation — this is a preview/query, not a mutation of state
  });
}
