"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWithdrawalStatus } from "@/hooks/useWithdrawalStatus";
import { postBalanceUpdate } from "@/lib/tabsync";
import { StatusTimelineSkeleton } from "@/components/shared/skeletons";
import type { WithdrawalStatus as WithdrawalStatusType } from "@/types/api";

const STATUSES: { key: WithdrawalStatusType | "UNKNOWN"; label: string }[] = [
  { key: "PENDING_APPROVAL", label: "Menunggu Persetujuan" },
  { key: "AML_HOLD", label: "Tinjauan Kepatuhan" },
  { key: "PAYING", label: "Sedang Dibayar" },
  { key: "PAID", label: "Berhasil" },
  { key: "REFUNDED", label: "Dikembalikan" },
];

function statusIndex(key: string): number {
  const idx = STATUSES.findIndex((s) => s.key === key);
  return idx >= 0 ? idx : -1;
}

function statusCopy(status: string): string | null {
  if (status === "AML_HOLD") {
    return "Sedang ditinjau kepatuhan — dana Anda aman dan direserve";
  }
  if (status === "REFUNDED") {
    return "Dikembalikan ke saldo Anda";
  }
  return null;
}

const TERMINAL = new Set(["PAID", "REFUNDED"]);

interface Props {
  withdrawalId: string;
}

export default function WithdrawalStatus({ withdrawalId }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useWithdrawalStatus(withdrawalId);

  const status = data?.status ?? "UNKNOWN";
  const terminal = TERMINAL.has(status);

  // On terminal status: refetch balance locally + notify other tabs
  useEffect(() => {
    if (!terminal) return;
    queryClient.invalidateQueries({ queryKey: ["balance"] });
    postBalanceUpdate();
  }, [terminal, queryClient]);

  if (isLoading) {
    return <StatusTimelineSkeleton />;
  }

  if (isError) {
    return (
      <div className="alert alert-warning">
        Tidak dapat memuat status penarikan. Coba lagi nanti.
      </div>
    );
  }

  const idx = statusIndex(status);
  const copy = statusCopy(status);

  return (
    <div className="card">
      <div className="card-body">
        <h6 className="card-title mb-3">Status Penarikan</h6>
        <div className="withdrawal-timeline">
          {STATUSES.map((s, i) => {
            const done = idx >= 0 && i <= idx && !(i === idx && status === "REFUNDED" && s.key === "PAID");
            const isCurrent = i === idx;
            const isRefunded = status === "REFUNDED" && s.key === "PAID";

            return (
              <div
                key={s.key}
                className={`d-flex align-items-center mb-2 ${
                  isCurrent ? "fw-bold" : done && !isRefunded ? "text-success" : "text-muted"
                }`}
              >
                <span className="me-2" style={{ width: 24, textAlign: "center" }}>
                  {done && !isRefunded ? (
                    <i className="fa fa-check-circle text-success" />
                  ) : isCurrent ? (
                    <div className="spinner-border spinner-border-sm" role="status">
                      <span className="visually-hidden">Saat ini</span>
                    </div>
                  ) : (
                    <i className="fa fa-circle" />
                  )}
                </span>
                <span>
                  {s.label}
                  {isCurrent && (
                    <span className="badge bg-theme text-dark ms-2">Saat ini</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {copy && (
          <div className="alert alert-info mt-3 mb-0 py-2">{copy}</div>
        )}
        {status === "UNKNOWN" && (
          <div className="alert alert-secondary mt-3 mb-0 py-2">Memproses</div>
        )}
      </div>
    </div>
  );
}
