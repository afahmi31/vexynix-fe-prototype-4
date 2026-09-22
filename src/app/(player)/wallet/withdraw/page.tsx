"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
import { useSessionStore } from "@/stores/session";
import { useClientRef } from "@/lib/idempotency";
import { walletApi } from "@/lib/api/wallet";
import { useBalance } from "@/hooks/useBalance";
import { useDestinations } from "@/hooks/useDestinations";
import { useTransactionLock, useActionDisabled } from "@/hooks/useTransactionLock";
import { useSessionExpired } from "@/hooks/useSessionExpired";
import { isSessionExpiredError } from "@/lib/auth-redirect";
import { mapWithdrawalError } from "@/lib/withdrawal-errors";
import WithdrawalStatus from "@/components/wallet/WithdrawalStatus";
import type { AddDestinationRes, WithdrawalRes, PayoutDestination } from "@/types/api";

const BANK_CODES = ["BCA", "BNI", "BRI", "Mandiri", "CIMB", "Permata"];

const accountSchema = z.object({
  kind: z.enum(["bank", "ewallet"]),
  bank_code: z.string().min(1, "Pilih bank"),
  account: z
    .string()
    .regex(/^\d{8,20}$/, "Nomor rekening: 8-20 digit"),
});

const withdrawSchema = z.object({
  amount: z
    .number()
    .int()
    .min(10_000, "Minimum Rp 10.000"),
});

type PageState = "form" | "withdrawal-detail";

function formatIDR(n: number): string {
  if (!n) return "";
  return n.toLocaleString("id-ID");
}

function cooldownRemaining(usableAfter: string): number {
  const target = new Date(usableAfter).getTime();
  const now = Date.now();
  return Math.max(0, target - now);
}

export default function WithdrawPage() {
  const userId = useSessionStore((s) => s.userId);
  const currency = useSessionStore((s) => s.currency);
  const { ref: clientRef, reset: resetClientRef } = useClientRef();
  const { withLock } = useTransactionLock();
  const actionDisabled = useActionDisabled();
  const sessionExpired = useSessionExpired();

  const { data: balanceData } = useBalance();
  const {
    data: destData,
    isLoading: destLoading,
    refetch: refetchDestinations,
  } = useDestinations();

  const balanceAvailable = balanceData?.balance?.available ?? 0;

  // --- Destination add modal state ---
  const [showAddDest, setShowAddDest] = useState(false);
  const [destKind, setDestKind] = useState<"bank" | "ewallet">("bank");
  const [destBankCode, setDestBankCode] = useState("");
  const [destAccount, setDestAccount] = useState("");
  const [destErrors, setDestErrors] = useState<{
    bank_code?: string;
    account?: string;
  }>({});
  const [destSubmitError, setDestSubmitError] = useState<string | null>(null);
  const [destSubmitting, setDestSubmitting] = useState(false);
  const [destSuccess, setDestSuccess] = useState<AddDestinationRes | null>(null);

  // --- Withdraw form state ---
  const [amount, setAmount] = useState(0);
  const [destinationId, setDestinationId] = useState("");
  const [withdrawErrors, setWithdrawErrors] = useState<{ amount?: string; destination?: string }>({});
  const [withdrawSubmitError, setWithdrawSubmitError] = useState<string | null>(null);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  // --- Page flow state ---
  const [pageState, setPageState] = useState<PageState>("form");
  const [withdrawal, setWithdrawal] = useState<WithdrawalRes | null>(null);

  const destinations = destData?.destinations ?? [];

  // --- Cool-down ticker ---
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Destination add handlers ---
  function openAddDest() {
    setDestKind("bank");
    setDestBankCode("");
    setDestAccount("");
    setDestErrors({});
    setDestSubmitError(null);
    setDestSuccess(null);
    setShowAddDest(true);
  }

  function closeAddDest() {
    setShowAddDest(false);
    setDestSubmitting(false);
  }

  async function handleAddDestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDestSubmitError(null);
    setDestSuccess(null);

    const result = accountSchema.safeParse({
      kind: destKind,
      bank_code: destBankCode,
      account: destAccount,
    });
    if (!result.success) {
      const errors: { bank_code?: string; account?: string } = {};
      for (const issue of result.error.issues) {
        if (issue.path[0] === "bank_code") errors.bank_code = issue.message;
        if (issue.path[0] === "account") errors.account = issue.message;
      }
      setDestErrors(errors);
      return;
    }

    setDestSubmitting(true);
    try {
      const res = await walletApi.addDestination({
        kind: destKind,
        bank_code: destBankCode,
        account: destAccount,
      });
      setDestSuccess(res);
      refetchDestinations();
    } catch (err) {
      const msg = mapWithdrawalError(err);
      if (msg) setDestSubmitError(msg);
    } finally {
      setDestSubmitting(false);
    }
  }

  // --- Withdraw form handlers ---
  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    const num = raw ? parseInt(raw, 10) : 0;
    setAmount(num);
    if (withdrawErrors.amount) setWithdrawErrors({});
  }

  async function handleWithdrawSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWithdrawSubmitError(null);

    if (actionDisabled) {
      setWithdrawSubmitError("Transaksi sedang diproses — mohon tunggu");
      return;
    }

    const errs: { amount?: string; destination?: string } = {};

    const amountResult = withdrawSchema.safeParse({ amount });
    if (!amountResult.success) {
      const issue = amountResult.error.issues.find((i) => i.path[0] === "amount");
      if (issue) errs.amount = issue.message;
    }

    if (amount > balanceAvailable) {
      errs.amount = "Saldo tidak cukup";
    }

    if (!destinationId) {
      errs.destination = "Pilih tujuan";
    }

    if (Object.keys(errs).length > 0) {
      setWithdrawErrors(errs);
      return;
    }

    // Session already gone locally — go straight to login rather than telling
    // the user about it and leaving them stuck on a dead form.
    if (!userId) {
      sessionExpired();
      return;
    }

    setWithdrawSubmitting(true);
    try {
      await withLock(async () => {
        const res = await walletApi.createWithdrawal({
          user_id: userId,
          amount,
          client_ref: clientRef,
          destination_id: destinationId,
        });
        setWithdrawal(res);
        setPageState("withdrawal-detail");
      });
    } catch (err) {
      // The token was rejected mid-submit — same treatment.
      if (isSessionExpiredError(err)) {
        sessionExpired();
        return;
      }
      const msg = mapWithdrawalError(err);
      if (msg) setWithdrawSubmitError(msg);
    } finally {
      setWithdrawSubmitting(false);
    }
  }

  function handleReset() {
    resetClientRef();
    setAmount(0);
    setDestinationId("");
    setWithdrawal(null);
    setPageState("form");
    setWithdrawSubmitError(null);
    setWithdrawErrors({});
  }

  // --- Helpers ---
  function isDestUsable(d: PayoutDestination): boolean {
    if (d.Revoked) return false;
    if (d.VerifiedAt) return true; // verified destinations are always usable
    const remaining = cooldownRemaining(d.usable_after);
    return remaining <= 0;
  }

  function cooldownLabel(d: PayoutDestination): string {
    if (d.Revoked) return "Dicabut";
    const remaining = cooldownRemaining(d.usable_after);
    if (remaining <= 0) return "Bisa digunakan";
    const minutes = Math.ceil(remaining / 60_000);
    if (minutes < 60) return `Tersedia dalam ${minutes}m`;
    const hours = Math.ceil(remaining / 3_600_000);
    return `Tersedia dalam ${hours}j`;
  }

  // ---- Withdrawal Detail state ----
  if (pageState === "withdrawal-detail" && withdrawal) {
    return (
      <>
        <h1 className="portal-page-title">Tarik</h1>
        <div className="portal-panel">
          <div className="portal-panel-header">Penarikan Diajukan</div>
          <div className="portal-panel-body">
            <div className="alert alert-success">
              Penarikan Rp {formatIDR(withdrawal.amount)} telah diajukan.
            </div>

            <div className="table-responsive mb-3">
              <table className="table table-sm">
                <tbody>
                  <tr>
                    <th>Referensi</th>
                    <td className="font-monospace">{withdrawal.id}</td>
                  </tr>
                  <tr>
                    <th>Nominal</th>
                    <td>Rp {formatIDR(withdrawal.amount)}</td>
                  </tr>
                  <tr>
                    <th>Status</th>
                    <td>{withdrawal.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <WithdrawalStatus withdrawalId={withdrawal.id} />

            <button className="btn btn-theme mt-3" onClick={handleReset}>
              Tarik Lagi
            </button>
          </div>
        </div>
      </>
    );
  }

  // ---- Main Form state ----
  return (
    <>
      <h1 className="portal-page-title">Tarik</h1>

      {/* Section 1: Destination Management */}
      <div className="portal-panel">
        <div className="portal-panel-header">Rekening Bank</div>
        <div className="portal-panel-body">
          {!destLoading && destinations.length > 0 && (
            <button className="btn btn-theme mb-3" onClick={openAddDest}>
              <i className="fa fa-plus me-1" />
              Tambah Rekening
            </button>
          )}

          {destLoading && (
            <div className="text-center py-2">
              <div className="spinner-border spinner-border-sm text-muted" role="status" />
            </div>
          )}

          {!destLoading && destinations.length === 0 && (
            <div className="text-center py-4 text-muted">
              <p>Belum ada rekening.</p>
              <button className="btn btn-outline-theme" onClick={openAddDest}>
                Tambah rekening pertama Anda
              </button>
            </div>
          )}

          {!destLoading && destinations.length > 0 && (
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Rekening</th>
                    <th>Bank</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {destinations.map((d) => (
                    <tr key={d.id}>
                      <td className="font-monospace">{d.masked_account}</td>
                      <td>
                        <span className="badge bg-secondary">{d.bank_code}</span>
                      </td>
                      <td>
                        {d.Revoked ? (
                          <span className="text-muted">Dicabut</span>
                        ) : isDestUsable(d) ? (
                          <span className="text-success">
                            <i className="fa fa-check-circle me-1" />
                            Bisa digunakan
                          </span>
                        ) : (
                          <span className="text-warning">{cooldownLabel(d)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Withdraw Form */}
      <div className="portal-panel mt-3">
        <div className="portal-panel-header">Tarik</div>
        <div className="portal-panel-body">
          {withdrawSubmitError && (
            <div className="alert alert-danger">{withdrawSubmitError}</div>
          )}

          <form onSubmit={handleWithdrawSubmit}>
            {/* Balance display */}
            <div className="mb-3">
              <label className="form-label">Saldo Tersedia</label>
              <div className="fs-5 fw-bold">
                {currency} {formatIDR(balanceAvailable)}
              </div>
            </div>

            {/* Amount */}
            <div className="mb-3">
              <label className="form-label">Nominal ({currency})</label>
              <div className="input-group">
                <span className="input-group-text">Rp</span>
                <input
                  type="text"
                  className={`form-control ${withdrawErrors.amount ? "is-invalid" : ""}`}
                  value={formatIDR(amount)}
                  onChange={handleAmountChange}
                  placeholder="10.000"
                  inputMode="numeric"
                />
                {withdrawErrors.amount && (
                  <div className="invalid-feedback">{withdrawErrors.amount}</div>
                )}
              </div>
              <small className="text-muted">Min Rp 10.000</small>
            </div>

            {/* Destination select */}
            <div className="mb-3">
              <label className="form-label">Tujuan</label>
              <select
                className={`form-select ${withdrawErrors.destination ? "is-invalid" : ""}`}
                value={destinationId}
                onChange={(e) => {
                  setDestinationId(e.target.value);
                  if (withdrawErrors.destination) setWithdrawErrors({});
                }}
              >
                <option value="">-- Pilih tujuan --</option>
                {destinations
                  .filter((d) => isDestUsable(d))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.masked_account} — {d.bank_code}
                    </option>
                  ))}
              </select>
              {withdrawErrors.destination && (
                <div className="invalid-feedback">{withdrawErrors.destination}</div>
              )}
              {destinations.filter((d) => isDestUsable(d)).length === 0 && !destLoading && (
                <small className="text-warning">
                  Tidak ada tujuan yang bisa dipakai. Tambah rekening dulu.
                </small>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-theme"
              disabled={withdrawSubmitting || actionDisabled}
            >
              {withdrawSubmitting && (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                />
              )}
              {withdrawSubmitting ? "Memproses..." : "Tarik"}
            </button>
          </form>
        </div>
      </div>

      {/* Add Destination Modal */}
      {showAddDest && (
        <div className="modal d-block" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Tambah Rekening</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeAddDest}
                  disabled={destSubmitting}
                />
              </div>
              <div className="modal-body">
                {destSubmitError && (
                  <div className="alert alert-danger">{destSubmitError}</div>
                )}
                {destSuccess && (
                  <div className="alert alert-success">
                    Rekening <strong>{destSuccess.masked_account}</strong> ditambahkan!
                    <br />
                    <small>
                      Tersedia setelah{" "}
                      {new Date(destSuccess.usable_after).toLocaleTimeString()}
                    </small>
                  </div>
                )}

                {!destSuccess && (
                  <form onSubmit={handleAddDestSubmit}>
                    <div className="mb-3">
                      <label className="form-label">Jenis</label>
                      <select
                        className="form-select"
                        value={destKind}
                        onChange={(e) => setDestKind(e.target.value as "bank" | "ewallet")}
                      >
                        <option value="bank">Bank</option>
                        <option value="ewallet">E-Wallet</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Bank</label>
                      <select
                        className={`form-select ${destErrors.bank_code ? "is-invalid" : ""}`}
                        value={destBankCode}
                        onChange={(e) => {
                          setDestBankCode(e.target.value);
                          if (destErrors.bank_code) setDestErrors({});
                        }}
                      >
                        <option value="">-- Pilih bank --</option>
                        {BANK_CODES.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                      {destErrors.bank_code && (
                        <div className="invalid-feedback">{destErrors.bank_code}</div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Nomor Rekening</label>
                      <input
                        type="text"
                        className={`form-control ${destErrors.account ? "is-invalid" : ""}`}
                        value={destAccount}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setDestAccount(digits);
                          if (destErrors.account) setDestErrors({});
                        }}
                        placeholder="1234567890"
                        inputMode="numeric"
                        maxLength={20}
                      />
                      {destErrors.account && (
                        <div className="invalid-feedback">{destErrors.account}</div>
                      )}
                    </div>

                    <div className="d-flex justify-content-end gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={closeAddDest}
                        disabled={destSubmitting}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="btn btn-theme"
                        disabled={destSubmitting}
                      >
                        {destSubmitting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" />
                            Menambah...
                          </>
                        ) : (
                          "Tambah"
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
              {destSuccess && (
                <div className="modal-footer">
                  <button className="btn btn-theme" onClick={closeAddDest}>
                    Tutup
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="modal-backdrop show" />
        </div>
      )}
    </>
  );
}
