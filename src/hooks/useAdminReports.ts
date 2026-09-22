/**
 * Reports hooks (P7.10) — payments report, auto-WD rules + decisions, swing config + history.
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useSessionStore } from "@/stores/session";
import {
  toPaymentsReport,
  toAutoWDRulesList,
  toAutoWDDecisionsList,
  toSwingConfig,
  toSwingHistoryList,
  type PaymentReportSummaryView,
  type AutoWDRuleView,
  type AutoWDDecisionView,
  type SwingConfigView,
  type SwingHistoryRun,
} from "@/lib/admin-recon";

const paymentsKey = ["admin", "reports", "payments"] as const;
const autoWDRulesKey = ["admin", "auto-wd", "rules"] as const;
const autoWDDecisionsKey = ["admin", "auto-wd", "decisions"] as const;
const swingConfigKey = ["admin", "swing", "config"] as const;
const swingHistoryKey = ["admin", "swing", "history"] as const;

export function usePaymentsReport() {
  const token = useSessionStore((s) => s.token);

  return useQuery<{ summary: PaymentReportSummaryView; byMethod?: Array<{ method: string; count: number; totalAmount: number }> }>({
    queryKey: paymentsKey,
    queryFn: async () => {
      const res = await adminApi.getPaymentsReport();
      return toPaymentsReport(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useAutoWDRules() {
  const token = useSessionStore((s) => s.token);

  return useQuery<{ rules: AutoWDRuleView[]; total: number }>({
    queryKey: autoWDRulesKey,
    queryFn: async () => {
      const res = await adminApi.getAutoWDRules();
      return toAutoWDRulesList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function usePutAutoWDRules() {
  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: autoWDRulesKey });
    void qc.invalidateQueries({ queryKey: autoWDDecisionsKey });
  }, [qc]);

  return useMutation<void, unknown, Partial<AutoWDRuleView>[]>({
    mutationFn: (rules) => {
      // Convert UI form format to wire format
      const wireRules = rules.map(r => ({
        id: r.id || "",
        name: r.name || "",
        enabled: !!r.enabled,
        min_amount: r.minAmount || 0,
        max_amount: r.maxAmount || 0,
        currency: r.currency || "IDR",
        player_segment: r.playerSegment || "All players",
        created_at: r.createdAt || undefined,
        updated_at: r.updatedAt || undefined,
      }));
      return adminApi.putAutoWDRules(wireRules);
    },
    onSettled: invalidate,
  });
}

export function useAutoWDDecisions() {
  const token = useSessionStore((s) => s.token);

  return useQuery<AutoWDDecisionView[]>({
    queryKey: autoWDDecisionsKey,
    queryFn: async () => {
      const res = await adminApi.listAutoWDDecisions();
      return toAutoWDDecisionsList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useSwingConfig() {
  const token = useSessionStore((s) => s.token);

  return useQuery<SwingConfigView>({
    queryKey: swingConfigKey,
    queryFn: async () => {
      const res = await adminApi.getSwingConfig();
      return toSwingConfig(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function usePutSwingConfig() {
  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: swingConfigKey });
    void qc.invalidateQueries({ queryKey: swingHistoryKey });
  }, [qc]);

  return useMutation<SwingConfigView, unknown, SwingConfigView>({
    mutationFn: async (config) => {
      const wireConfig = {
        enabled: config.enabled,
        strategy: config.strategy as "round_robin" | "weighted" | "performance",
        rebalance_interval_minutes: config.rebalanceIntervalMinutes,
      };
      await adminApi.putSwingConfig(wireConfig);
      return config;
    },
    onSettled: invalidate,
  });
}

export function useRunSwing() {
  const qc = useQueryClient();
  const invalidate = useCallback(
    () => void qc.invalidateQueries({ queryKey: swingHistoryKey }),
    [qc]
  );

  return useMutation<unknown, unknown, void>({
    mutationFn: () => adminApi.runSwing(),
    onSettled: invalidate,
  });
}

export function useSwingHistory() {
  const token = useSessionStore((s) => s.token);

  return useQuery<SwingHistoryRun[]>({
    queryKey: swingHistoryKey,
    queryFn: async () => {
      const res = await adminApi.getSwingHistory();
      return toSwingHistoryList(res);
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
