"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useSessionStore } from "@/stores/session";
import { useClientRef } from "@/lib/idempotency";
import { walletApi } from "@/lib/api/wallet";
import { useDepositStatus } from "@/hooks/useDepositStatus";
import { useTransactionLock, useActionDisabled } from "@/hooks/useTransactionLock";
import { useSessionExpired } from "@/hooks/useSessionExpired";
import { postBalanceUpdate } from "@/lib/tabsync";
import { isSessionExpiredError } from "@/lib/auth-redirect";
import { canSettleSandboxDeposit, describeSimulateError } from "@/lib/dev-payments";
import { mapDepositError } from "@/lib/deposit-errors";
import { bankOptionsFor, validateBankChoice } from "@/lib/deposit-banks";
import type { DepositRes, PaymentMethod } from "@/types/api";

/**
 * Icon per instrument. A lookup rather than a field on the API: an icon is a client
 * presentation choice, and shipping icon names from the server would make adding a method a
 * two-repo change for no gain. Anything unmapped falls back to a generic wallet glyph, so a
 * new method the platform adds renders correctly the day it appears — just less prettily.
 */
function methodIcon(code: string): string {
  switch (code) {
    case "qris":
      return "fa-qrcode";
    case "va":
      return "fa-building-columns";
    case "bank_transfer":
      return "fa-money-bill-transfer";
    case "ewallet":
      return "fa-wallet";
    default:
      return "fa-wallet";
  }
}

const depositSchema = z.object({
  amount: z
    .number()
    .int()
    .min(10_000, "Minimum Rp 10.000")
    .max(100_000_000, "Maximum Rp 100.000.000"),
  // 05A — the instruments come from the server now (the brand's offering × what rails are
  // live), so the client validates that ONE was chosen, not which ones exist.
  method: z.string().min(1, "Pilih metode pembayaran"),
});

type PageState = "form" | "instrument" | "terminal";
type TerminalKind = "success" | "failure";

function formatIDR(n: number): string {
  if (!n) return "";
  return n.toLocaleString("id-ID");
}

export default function DepositPage() {
  const userId = useSessionStore((s) => s.userId);
  const currency = useSessionStore((s) => s.currency);
  const sessionStatus = useSessionStore((s) => s.status);
  const { ref: clientRef, reset: resetClientRef } = useClientRef();
  const queryClient = useQueryClient();
  const { withLock } = useTransactionLock();
  const actionDisabled = useActionDisabled();
  const sessionExpired = useSessionExpired();

  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<string>("");
  // The player's bank choice for instruments that require one (a VA is issued AT a bank).
  // Deliberately cleared whenever the method changes: carrying a bank across a switch to QRIS
  // would send a field the rail does not want, and back again would silently re-apply a choice
  // the player made for a different instrument.
  const [bank, setBank] = useState<string>("");
  const [payMethods, setPayMethods] = useState<PaymentMethod[] | null>(null);
  const [methodsError, setMethodsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    amount?: string;
    method?: string;
    bank?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deposit, setDeposit] = useState<DepositRes | null>(null);
  const [pageState, setPageState] = useState<PageState>("form");
  const [terminalKind, setTerminalKind] = useState<TerminalKind | null>(null);
  const [copied, setCopied] = useState(false);
  const [activated, setActivated] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  // 05C — a manual deposit is confirmed by a person. These carry the player's own claim about
  // the transfer they made, which is what an operator matches against the bank statement.
  const [proof, setProof] = useState({ name: "", bank: "", account: "", reference: "" });
  const [proofSending, setProofSending] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  const depositId =
    pageState === "instrument" || pageState === "terminal"
      ? (deposit?.transaction_id ?? null)
      : null;
  const depositStatus = useDepositStatus(depositId);

  // 05A — which instruments this brand offers, live from the server. A failure here is not
  // fatal to the page: the form falls back to letting the player proceed with no explicit
  // method (the API treats an empty method as "no preference" and routes as it always did),
  // so a methods outage degrades the choice rather than blocking deposits entirely.
  useEffect(() => {
    let live = true;
    walletApi
      .paymentMethods()
      .then((res) => {
        if (!live) return;
        const items = res.items ?? [];
        setPayMethods(items);
        // Preselect the first USABLE one — the list now includes unusable methods on purpose
        // (they render disabled with a reason), and defaulting onto one would hand the player
        // a form they cannot submit.
        const first = items.find((m) => m.available);
        setMethod((cur) => (cur === "" && first ? first.code : cur));
      })
      .catch(() => {
        if (live) setMethodsError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Watch for terminal status from polling
  const polledStatus = depositStatus.data?.status;

  useEffect(() => {
    if (!polledStatus || pageState !== "instrument") return;

    if (polledStatus === "PAID") {
      if (sessionStatus === "pending") {
        useSessionStore.setState({ status: "active" });
        setActivated(true);
      }
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      postBalanceUpdate();
      setPageState("terminal");
      setTerminalKind("success");
    } else if (
      polledStatus === "FAILED" ||
      polledStatus === "EXPIRED" ||
      polledStatus === "CANCELLED"
    ) {
      postBalanceUpdate();
      setPageState("terminal");
      setTerminalKind("failure");
    }
  }, [polledStatus, pageState, sessionStatus, queryClient]);

  // --- DEV: the sandbox (test) gateway can be completed without paying ---

  async function settleSandbox(dep: DepositRes) {
    setSimulateError(null);
    setSimulating(true);
    try {
      await walletApi.settleSandboxDeposit(dep.provider_ref);
      // Don't sit through the 5s poll — ask for the new status straight away.
      await queryClient.invalidateQueries({
        queryKey: ["deposit", dep.transaction_id],
      });
    } catch (err) {
      setSimulateError(describeSimulateError(err));
    } finally {
      setSimulating(false);
    }
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    const num = raw ? parseInt(raw, 10) : 0;
    setAmount(num);
    if (fieldErrors.amount) setFieldErrors({});
  }

  // The banks the CURRENTLY selected instrument offers. Empty for QRIS and for any method the
  // rail serves without a sub-choice, which is what keeps the picker from appearing at all.
  const bankOptions = bankOptionsFor(payMethods, method);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (actionDisabled) {
      setSubmitError("Transaksi sedang diproses — mohon tunggu");
      return;
    }

    const result = depositSchema.safeParse({ amount, method });
    if (!result.success) {
      const errors: { amount?: string; method?: string } = {};
      const amountIssue = result.error.issues.find(
        (i) => i.path[0] === "amount"
      );
      if (amountIssue) errors.amount = amountIssue.message;
      const methodIssue = result.error.issues.find(
        (i) => i.path[0] === "method"
      );
      if (methodIssue) errors.method = methodIssue.message;
      setFieldErrors(errors);
      return;
    }

    // Session already gone locally — go straight to login rather than telling
    // the user about it and leaving them stuck on a dead form.
    if (!userId) {
      sessionExpired();
      return;
    }

    // A method that offers banks needs one picked. Validated rather than defaulted silently:
    // which bank a player transfers to is their decision, and choosing for them is how someone
    // ends up with a virtual account at a bank they cannot pay from.
    const bankIssue = validateBankChoice(bankOptions, bank);
    if (bankIssue) {
      setFieldErrors({ bank: bankIssue });
      return;
    }

    setSubmitting(true);
    try {
      await withLock(async () => {
        const res = await walletApi.createDeposit({
          user_id: userId,
          amount,
          currency,
          method,
          client_ref: clientRef,
          // Only sent for an instrument that actually offers a choice.
          ...(bankOptions.length > 0 && bank ? { bank } : {}),
        });
        setDeposit(res);
        setPageState("instrument");
      });
    } catch (err) {
      // The token was rejected mid-submit — same treatment.
      if (isSessionExpiredError(err)) {
        sessionExpired();
        return;
      }
      setSubmitError(mapDepositError(err));
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Tells the backoffice the transfer has been made. This does NOT credit anything — it moves
   * the ticket into the operator's queue, and the balance follows only once a human has
   * matched it against the bank statement. Saying so plainly on the button matters: a player
   * who thinks this button IS the deposit will open a second one when nothing arrives.
   */
  async function handleSubmitProof() {
    if (!deposit) return;
    if (proof.name.trim() === "") {
      setProofError("Nama pengirim wajib diisi agar operator bisa mencocokkan mutasi.");
      return;
    }
    setProofSending(true);
    setProofError(null);
    try {
      await walletApi.submitManualProof(deposit.transaction_id, {
        sender_name: proof.name.trim(),
        sender_bank: proof.bank.trim(),
        sender_account: proof.account.trim(),
        reference: proof.reference.trim(),
      });
      await queryClient.invalidateQueries({
        queryKey: ["deposit", deposit.transaction_id],
      });
    } catch (err) {
      if (isSessionExpiredError(err)) {
        sessionExpired();
        return;
      }
      setProofError("Gagal mengirim konfirmasi. Coba lagi.");
    } finally {
      setProofSending(false);
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — ignore
    }
  }

  function handleReset() {
    resetClientRef();
    setDeposit(null);
    setPageState("form");
    setTerminalKind(null);
    setSubmitError(null);
    setActivated(false);
    setAmount(0);
    setSimulateError(null);
    setProof({ name: "", bank: "", account: "", reference: "" });
    setProofError(null);
  }

  // ---- Render helpers ----

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      SUBMITTED: "bg-warning",
      PENDING: "bg-warning",
      PROCESSING: "bg-info",
      PAID: "bg-success",
      FAILED: "bg-danger",
      EXPIRED: "bg-secondary",
      CANCELLED: "bg-secondary",
    };
    const label: Record<string, string> = {
      SUBMITTED: "Menunggu Pembayaran",
      PENDING: "Menunggu Pembayaran",
      // On the manual rail PROCESSING means "the player says they paid, an operator is
      // checking" — not "the gateway is working on it".
      PROCESSING: "Menunggu Verifikasi",
      PAID: "Berhasil",
      FAILED: "Gagal",
      EXPIRED: "Kedaluwarsa",
      CANCELLED: "Dibatalkan",
    };
    return (
      <span className={`badge ${map[status] ?? "bg-secondary"}`}>
        {label[status] ?? status}
      </span>
    );
  }

  // ---- Form state ----

  const QUICK_AMOUNTS = [50_000, 100_000, 250_000, 500_000, 1_000_000];

  if (pageState === "form") {
    return (
      <>
        <h1 className="portal-page-title">Deposit</h1>
        <div className="portal-panel">
          <div className="portal-panel-header">Deposit</div>
          <div className="portal-panel-body">
            {/* A pending account was sent here straight from login — say why. */}
            {sessionStatus === "pending" && (
              <div className="alert alert-warning">
                <strong>Akun belum aktif.</strong> Lakukan deposit pertama untuk
                mengaktifkan akun Anda.
              </div>
            )}
            {submitError && (
              <div className="alert alert-danger">{submitError}</div>
            )}
            <form onSubmit={handleSubmit} className="mb-3">
              <div className="mb-3">
                <label className="form-label">Nominal ({currency})</label>
                <div className="input-group">
                  <span className="input-group-text">Rp</span>
                  <input
                    type="text"
                    className={`form-control ${fieldErrors.amount ? "is-invalid" : ""}`}
                    value={formatIDR(amount)}
                    onChange={handleAmountChange}
                    placeholder="10.000"
                    inputMode="numeric"
                  />
                  {fieldErrors.amount && (
                    <div className="invalid-feedback">{fieldErrors.amount}</div>
                  )}
                </div>
                <small className="text-muted">
                  Min Rp 10.000 — Max Rp 100.000.000
                </small>

                {/* Quick amount buttons */}
                <div className="deposit-quick-amounts mt-2">
                  {QUICK_AMOUNTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`deposit-quick-chip ${amount === preset ? "active" : ""}`}
                      onClick={() => {
                        setAmount(preset);
                        if (fieldErrors.amount) setFieldErrors({});
                      }}
                    >
                      {formatIDR(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Metode Pembayaran</label>
                {payMethods === null && !methodsError ? (
                  <div className="text-muted small">Memuat metode…</div>
                ) : payMethods !== null &&
                  !payMethods.some((m) => m.available) ? (
                  <div className="alert alert-warning py-2 small mb-0">
                    Tidak ada metode pembayaran yang aktif saat ini. Silakan hubungi customer
                    service.
                  </div>
                ) : (
                  <div className="deposit-method-cards">
                    {(payMethods ?? []).map((m) => (
                      <button
                        key={m.code}
                        type="button"
                        className={`deposit-method-card ${method === m.code ? "active" : ""}`}
                        onClick={() => {
                          setMethod(m.code);
                          setBank("");
                        }}
                        /* Unusable methods stay VISIBLE and disabled with the server's own
                           reason, rather than vanishing: a card that disappears teaches the
                           player nothing and sends them to support asking where it went. */
                        disabled={!m.available}
                        title={m.reason || undefined}
                      >
                        <i
                          className={`fa-solid ${methodIcon(m.code)} deposit-method-icon`}
                        />
                        <div className="deposit-method-name">{m.display_name}</div>
                        <div className="deposit-method-desc">
                          {m.available ? m.description : m.reason}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {fieldErrors.method && (
                  <div className="text-danger small mt-1">{fieldErrors.method}</div>
                )}
              </div>

              {/* Only rendered when the chosen instrument actually offers a choice, and the
                  options come from the rail — so a bank the vendor adds appears here with no
                  client release, and one they drop stops being offered the same day. */}
              {bankOptions.length > 0 && (
                <div className="mb-3">
                  <label className="form-label">Bank Tujuan</label>
                  <div className="deposit-method-cards">
                    {bankOptions.map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={`deposit-method-card ${bank === b ? "active" : ""}`}
                        onClick={() => {
                          setBank(b)
                          // Clear the "pick a bank" complaint the moment they pick one. Leaving
                          // it up next to a now-selected bank reads as a rejection of the choice
                          // they just made, and sends them looking for a different bank.
                          setFieldErrors((f) => ({ ...f, bank: undefined }))
                        }}
                      >
                        <i className="fa-solid fa-building-columns deposit-method-icon" />
                        <div className="deposit-method-name">{b}</div>
                      </button>
                    ))}
                  </div>
                  <div className="text-muted small mt-1">
                    Nomor Virtual Account akan dibuat di bank yang Anda pilih.
                  </div>
                  {fieldErrors.bank && (
                    <div className="text-danger small mt-1">{fieldErrors.bank}</div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-theme"
                disabled={submitting || actionDisabled}
              >
                {submitting && (
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  />
                )}
                {submitting ? "Memproses..." : "Deposit"}
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  // ---- Terminal state ----

  if (pageState === "terminal") {
    const finalStatus = depositStatus.data?.status ?? deposit?.status ?? "";
    return (
      <>
        <h1 className="portal-page-title">Deposit</h1>
        <div className="portal-panel">
          <div className="portal-panel-header">Hasil Deposit</div>
          <div className="portal-panel-body">
            {terminalKind === "success" ? (
              <>
                {activated && (
                  <div className="alert alert-success">
                    <strong>Akun Aktif!</strong> Akun Anda sekarang aktif.
                  </div>
                )}
                <div className="alert alert-success">
                  Deposit Rp {formatIDR(deposit?.amount ?? 0)} berhasil!{" "}
                  {statusBadge(finalStatus)}
                </div>
              </>
            ) : (
              <div className="alert alert-danger">
                Deposit {statusBadge(finalStatus)}
                <p className="mb-0 mt-1">
                  {/* A manual deposit that an operator rejected has a REASON, and the player
                      is the person who needs it most — "coba lagi" alone sends them straight
                      into a second identical ticket. */}
                  {depositStatus.data?.manual_ticket?.reason
                    ? depositStatus.data.manual_ticket.reason
                    : "Deposit Anda tidak dapat diproses. Silakan coba lagi."}
                </p>
                {/* Money that really arrived on a rejected deposit is transferred back by
                    hand; without this line the player's next move is a support ticket. */}
                {depositStatus.data?.manual_ticket?.refund_status ===
                  "refund_pending" && (
                  <p className="mb-0 mt-1">
                    Dana yang sudah Anda transfer akan dikembalikan ke rekening pengirim.
                  </p>
                )}
                {depositStatus.data?.manual_ticket?.refund_status === "refunded" && (
                  <p className="mb-0 mt-1">
                    Dana yang sudah Anda transfer telah dikembalikan ke rekening pengirim.
                  </p>
                )}
              </div>
            )}

            <div className="table-responsive">
              <table className="table table-sm">
                <tbody>
                  <tr>
                    <th>Referensi</th>
                    <td className="font-monospace">
                      {deposit?.transaction_id}
                    </td>
                  </tr>
                  <tr>
                    <th>Nominal</th>
                    <td>Rp {formatIDR(deposit?.amount ?? 0)}</td>
                  </tr>
                  <tr>
                    <th>Biaya</th>
                    <td>Rp {formatIDR(deposit?.fee ?? 0)}</td>
                  </tr>
                  <tr>
                    <th>Total Dibayar</th>
                    <td>Rp {formatIDR(deposit?.total_charge ?? 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <button className="btn btn-theme" onClick={handleReset}>
              Deposit Baru
            </button>
          </div>
        </div>
      </>
    );
  }

  // ---- Instrument state (default / "instrument") ----

  const currentStatus = depositStatus.data?.status ?? deposit?.status ?? "SUBMITTED";
  const vaNumber = depositStatus.data?.va_number ?? deposit?.va_number;
  // A QRIS rail returns an IMAGE where a VA rail returns a number, and the field carrying it is
  // the same one — `va_number` is really "the instrument the player pays into". Which shape it is
  // depends on the rail behind the brand's gateway, and the player app is not told which rail that
  // is (05D: a gateway is a label, the rail is platform-only), so the shape is detected here.
  //
  //   qrismvp   `data:image/png;base64,…`   a rendered QR, straight into <img>
  //   abcfastpy `https://…`                  a hosted QR page/image
  //
  // Anything else stays in the copy box it has always used. Note what is deliberately NOT handled:
  // a raw QRIS EMV payload (`0002010102…`), which qrismvp returns when its `api_version` is "2".
  // There is no QR renderer in this app, so that string would reach the player as unscannable
  // text — which is exactly why the rail is configured to ask for the image instead.
  const qrImage =
    typeof vaNumber === "string" &&
    (vaNumber.startsWith("data:image/") || /^https:\/\//.test(vaNumber))
      ? vaNumber
      : null;
  // 05C: the destination comes back on the CREATE response and again on every status poll, so
  // a reload still shows the account the player may already have transferred to.
  const manualDest = deposit?.manual ?? depositStatus.data?.manual_ticket?.destination;
  const ticketStatus = depositStatus.data?.manual_ticket?.status;
  const awaitingReview = ticketStatus === "pending_review" || ticketStatus === "reviewing";

  if (manualDest) {
    return (
      <>
        <h1 className="portal-page-title">Deposit</h1>
        <div className="portal-panel">
          <div className="portal-panel-header">Instruksi Transfer</div>
          <div className="portal-panel-body">
            <div className="mb-3 d-flex align-items-center gap-2">
              {statusBadge(currentStatus)}
              {depositStatus.isFetching && (
                <span className="spinner-border spinner-border-sm text-muted" role="status" />
              )}
            </div>

            <div className="alert alert-info">
              Transfer <strong>tepat Rp {formatIDR(deposit?.total_charge ?? 0)}</strong> ke
              rekening di bawah, lalu konfirmasi. Saldo masuk setelah operator mencocokkan
              dengan mutasi bank — biasanya beberapa menit pada jam kerja.
            </div>

            <div className="table-responsive mb-3">
              <table className="table table-sm">
                <tbody>
                  <tr>
                    <th>Bank / Wallet</th>
                    <td>{manualDest.bank_name || manualDest.bank_code}</td>
                  </tr>
                  <tr>
                    <th>Nomor Rekening</th>
                    <td>
                      <span className="font-monospace fs-5">
                        {manualDest.account_number}
                      </span>
                      <button
                        className="btn btn-sm btn-outline-theme ms-2"
                        type="button"
                        onClick={() => handleCopy(manualDest.account_number)}
                      >
                        {copied ? "Tersalin!" : "Salin"}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <th>Atas Nama</th>
                    <td>{manualDest.account_name}</td>
                  </tr>
                  <tr className="fw-bold">
                    <th>Jumlah Transfer</th>
                    <td>Rp {formatIDR(deposit?.total_charge ?? 0)}</td>
                  </tr>
                  <tr>
                    <th>Referensi</th>
                    <td className="font-monospace">{deposit?.transaction_id}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {manualDest.instructions && (
              <p className="text-muted">{manualDest.instructions}</p>
            )}

            {awaitingReview ? (
              <div className="alert alert-warning">
                <strong>Menunggu verifikasi operator.</strong> Konfirmasi Anda sudah kami
                terima. Jangan transfer ulang — halaman ini akan berubah sendiri begitu
                deposit disetujui.
              </div>
            ) : (
              <>
                <h2 className="h6 mt-4">Konfirmasi Transfer</h2>
                <p className="text-muted">
                  Isi data rekening pengirim agar operator dapat mencocokkannya dengan mutasi.
                </p>
                {proofError && <div className="alert alert-danger">{proofError}</div>}
                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="proof-name">
                      Nama Pengirim
                    </label>
                    <input
                      id="proof-name"
                      className="form-control"
                      value={proof.name}
                      onChange={(e) => setProof({ ...proof, name: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="proof-bank">
                      Bank Pengirim
                    </label>
                    <input
                      id="proof-bank"
                      className="form-control"
                      placeholder="BCA"
                      value={proof.bank}
                      onChange={(e) => setProof({ ...proof, bank: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="proof-account">
                      Nomor Rekening Pengirim
                    </label>
                    <input
                      id="proof-account"
                      className="form-control font-monospace"
                      value={proof.account}
                      onChange={(e) => setProof({ ...proof, account: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="proof-ref">
                      Kode / Berita Transfer (opsional)
                    </label>
                    <input
                      id="proof-ref"
                      className="form-control"
                      value={proof.reference}
                      onChange={(e) => setProof({ ...proof, reference: e.target.value })}
                    />
                  </div>
                </div>
                <button
                  className="btn btn-theme"
                  type="button"
                  disabled={proofSending}
                  onClick={handleSubmitProof}
                >
                  {proofSending ? "Mengirim..." : "Saya Sudah Transfer"}
                </button>
              </>
            )}

            <div className="mt-3">
              <button className="btn btn-outline-secondary" onClick={handleReset}>
                Kembali
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="portal-page-title">Deposit</h1>
      <div className="portal-panel">
        <div className="portal-panel-header">Instruksi Pembayaran</div>
        <div className="portal-panel-body">
          {depositStatus.isError && (
            <div className="alert alert-warning">
              Tidak dapat mengecek status pembayaran. Mencoba lagi...
            </div>
          )}

          <div className="mb-3 d-flex align-items-center gap-2">
            {statusBadge(currentStatus)}
            {depositStatus.isFetching && (
              <span
                className="spinner-border spinner-border-sm text-muted"
                role="status"
              />
            )}
          </div>

          {/* QRIS display. First, because a QR is the whole payment instrument on this rail and
              putting it in a copy box — which is what happened before this branch existed — hands
              the player a base64 blob they cannot scan.
              Not next/image: the source is a data URI or a vendor host, neither of which the
              optimizer can be configured for, and a QR must render at exact pixels anyway. */}
          {qrImage ? (
            <div className="mb-4 text-center">
              <label className="form-label d-block">Pembayaran QRIS</label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImage}
                alt="Kode QRIS untuk pembayaran deposit"
                className="img-fluid border rounded bg-white p-2"
                style={{ maxWidth: 280 }}
              />
              <div className="text-muted small mt-2">
                Scan dengan e-wallet atau aplikasi banking Anda. Saldo masuk otomatis setelah
                pembayaran terverifikasi.
              </div>
            </div>
          ) : method === "va" && vaNumber ? (
            <div className="mb-4">
              <label className="form-label">Nomor Virtual Account</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control form-control-lg font-monospace"
                  value={vaNumber}
                  readOnly
                />
                <button
                  className="btn btn-outline-theme"
                  type="button"
                  onClick={() => handleCopy(vaNumber)}
                >
                  {copied ? "Tersalin!" : "Salin"}
                </button>
              </div>
              <small className="text-muted">
                Transfer sesuai nominal ke nomor VA di atas.
              </small>
            </div>
          ) : method === "qris" && !vaNumber ? (
            <div className="mb-4">
              <label className="form-label">Pembayaran QRIS</label>
              <div className="alert alert-info">
                Scan kode QR dari e-wallet atau aplikasi banking Anda untuk
                menyelesaikan pembayaran. Gunakan referensi{" "}
                <code className="font-monospace">
                  {deposit?.provider_ref}
                </code>{" "}
                jika diminta.
              </div>
            </div>
          ) : vaNumber ? (
            <div className="mb-4">
              <label className="form-label">Nomor Rekening / Referensi</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control form-control-lg font-monospace"
                  value={vaNumber}
                  readOnly
                />
                <button
                  className="btn btn-outline-theme"
                  type="button"
                  onClick={() => handleCopy(vaNumber)}
                >
                  {copied ? "Tersalin!" : "Salin"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <label className="form-label">Referensi</label>
              <p className="font-monospace fs-5">
                {deposit?.provider_ref}
              </p>
            </div>
          )}

          {/* Fee breakdown */}
          <div className="table-responsive mb-3">
            <table className="table table-sm">
              <tbody>
                <tr>
                  <th>Nominal</th>
                  <td className="text-end">
                    Rp {formatIDR(deposit?.amount ?? 0)}
                  </td>
                </tr>
                <tr>
                  <th>Biaya</th>
                  <td className="text-end">
                    Rp {formatIDR(deposit?.fee ?? 0)}
                  </td>
                </tr>
                <tr className="fw-bold">
                  <th>Total Bayar</th>
                  <td className="text-end">
                    Rp {formatIDR(deposit?.total_charge ?? 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {deposit && canSettleSandboxDeposit(deposit.provider_id) && (
            <div className="dev-simulate">
              <div className="dev-simulate-title">
                <span className="dev-simulate-badge">SANDBOX</span>
                Gateway test — tidak perlu bayar sungguhan
              </div>
              <p className="dev-simulate-text">
                Deposit ini memakai gateway sandbox. Klik tombol di bawah untuk
                menyelesaikan pembayaran tanpa transfer nyata.
              </p>
              {simulateError && (
                <p className="dev-simulate-error">{simulateError}</p>
              )}
              <button
                type="button"
                className="btn btn-theme"
                onClick={() => settleSandbox(deposit)}
                disabled={simulating}
              >
                {simulating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Menyelesaikan...
                  </>
                ) : (
                  "Selesaikan Pembayaran (Simulasi)"
                )}
              </button>
            </div>
          )}

          <button className="btn btn-outline-secondary" onClick={handleReset}>
            Batal
          </button>
        </div>
      </div>
    </>
  );
}
