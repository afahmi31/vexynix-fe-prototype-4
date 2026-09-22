import { apiFetch } from "./client";
import type {
  DepositReq,
  DepositRes,
  DepositStatusRes,
  ManualProofReq,
  DestinationsRes,
  AddDestinationReq,
  AddDestinationRes,
  CreateWithdrawalReq,
  WithdrawalRes,
  PaymentMethodsRes,
} from "@/types/api";

export const walletApi = {
  createDeposit: (req: DepositReq) =>
    apiFetch<DepositRes>("/api/spg/v1/deposits", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  getDeposit: (id: string) =>
    apiFetch<DepositStatusRes>(`/api/spg/v1/deposits/${id}`),

  /**
   * 05C — "saya sudah transfer". A deposit on the MANUAL rail is confirmed by a person, not a
   * callback, so this is what moves the ticket into the operator's verification queue. It
   * moves no money and creates nothing: the deposit and its ticket already exist from
   * createDeposit. The player's own session gates it; someone else's deposit answers 404.
   */
  submitManualProof: (id: string, proof: ManualProofReq) =>
    apiFetch<{ status: string }>(`/api/spg/v1/deposits/${id}/manual-proof`, {
      method: "POST",
      body: JSON.stringify(proof),
    }),

  /**
   * The deposit instruments THIS player may use (05A). Replaces the hard-coded
   * `"qris" | "va"` union that used to live in the client: the brand's own offering, the
   * platform catalogue and which rails are actually live all decide this, and the SAME
   * derivation validates `createDeposit` — so the form can never offer a card the API would
   * then refuse.
   */
  paymentMethods: () =>
    apiFetch<PaymentMethodsRes>("/api/spg/v1/me/payment-methods"),

  /**
   * DEV ONLY — complete a SANDBOX deposit with no real payment. The BFF
   * forwards this to SPG's sandbox webhook from inside the trusted network
   * (the webhook's IP allow-list refuses a developer's machine directly). The
   * route exists only when the BFF runs with WEB_ALLOW_SANDBOX_SETTLE and
   * requires the player's session. Gated by canSimulatePayment at call sites.
   */
  settleSandboxDeposit: (providerRef: string, status = "PAID") =>
    apiFetch<{ status: string }>("/api/dev/sandbox-settle", {
      method: "POST",
      body: JSON.stringify({ provider_ref: providerRef, status }),
    }),

  destinations: () =>
    apiFetch<DestinationsRes>("/api/spg/v1/payout-destinations"),
  addDestination: (req: AddDestinationReq) =>
    apiFetch<AddDestinationRes>("/api/spg/v1/payout-destinations", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  createWithdrawal: (req: CreateWithdrawalReq) =>
    apiFetch<WithdrawalRes>("/api/spg/v1/withdrawals", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  getWithdrawal: (id: string) =>
    apiFetch<WithdrawalRes>(`/api/spg/v1/withdrawals/${id}`),
};
