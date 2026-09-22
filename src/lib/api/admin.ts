/**
 * Merchant-admin API module (P7.3 players + P7.4 withdrawal approvals + P7.5 operator payouts).
 * All endpoints are tenant-scoped SPG routes via /api/spg/* (inventory:
 * docs/03-ADMIN-SURFACES.md §3.1). Money-moving actions (approve, AML
 * resolve, propose/approve payout) return 401 STEP_UP_REQUIRED on stale sessions 
 * — apiFetch handles the step-up modal + retry globally (P4.1), nothing to do here.
 */
import { apiFetch } from "./client";
import type {
  AddMerchantDomainReq,
  AddMerchantDomainRes,
  AddPlayerNoteReq,
  AdminPlayerAuditRes,
  AdminPlayerListRes,
  AdminPlayerNotesRes,
  AdminPlayerProfileRes,
  AdminRegisterPlayerReq,
  AdminWithdrawalListRes,
  AutoWDDecisionsRes,
  AutoWDRulesRes,
  AutoWDRule,
  CreateOperatorPayoutRes,
  CreateProviderReq,
  CreateProviderRes,
  CurrenciesListRes,
  DepositTransactionsRes,
  FXConvertRes,
  FXRatesListRes,
  MerchantAuditRes,
  MerchantPasswordReq,
  MerchantPasswordRes,
  MerchantProfileReq,
  MerchantProfileRes,
  OperatorEarningsRes,
  OperatorPayoutCallbackReq,
  OperatorPayoutDetailRes,
  OperatorPayoutListRes,
  PayoutMismatchesRes,
  PayoutReconcileRun,
  PaymentsReportRes,
  ProposeOperatorPayoutReq,
  ProviderBalanceRes,
  ProvidersListRes,
  RegisterRes,
  ResolveAmlReq,
  SetFXRateReq,
  SetFXRateRes,
  SelfExcludeReq,
  SetPlayerLimitsReq,
  SetPlayerStatusReq,
  SwingConfig,
  SwingHistoryRes,
  SwingRun,
  ToggleVendorReq,
  ToggleVendorRes,
  UpdateProviderReq,
  UpdateProviderRes,
  UpsertCurrencyReq,
  UpsertCurrencyRes,
  VendorsRes,
  VerifyMerchantDomainReq,
  VerifyMerchantDomainRes,
  WithdrawalStatus,
} from "@/types/api";

const SPG = "/api/spg/v1";

/** Query params for the players directory (names assumed — see types/api.ts). */
export interface ListPlayersParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}

function playersQuery({ page, limit, search, status }: ListPlayersParams): string {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("limit", String(limit));
  if (search) q.set("search", search);
  if (status) q.set("status", status);
  return q.toString();
}

export const adminApi = {
  // --- P7.3: players ---
  listPlayers: (params: ListPlayersParams) =>
    apiFetch<AdminPlayerListRes>(`${SPG}/admin/players?${playersQuery(params)}`),

  getPlayerProfile: (id: number | string) =>
    apiFetch<AdminPlayerProfileRes>(`${SPG}/admin/players/${id}`),

  registerPlayer: (req: AdminRegisterPlayerReq) =>
    apiFetch<RegisterRes>(`${SPG}/admin/players`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  setPlayerLimits: (id: number | string, req: SetPlayerLimitsReq) =>
    apiFetch<void>(`${SPG}/admin/players/${id}/limits`, {
      method: "PUT",
      body: JSON.stringify(req),
    }),

  selfExcludePlayer: (id: number | string, req: SelfExcludeReq) =>
    apiFetch<void>(`${SPG}/admin/players/${id}/self-exclude`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  freezePlayer: (id: number | string) =>
    apiFetch<void>(`${SPG}/admin/players/${id}/freeze`, { method: "POST" }),

  unfreezePlayer: (id: number | string) =>
    apiFetch<void>(`${SPG}/admin/players/${id}/unfreeze`, { method: "POST" }),

  setPlayerStatus: (id: number | string, req: SetPlayerStatusReq) =>
    apiFetch<void>(`${SPG}/admin/players/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(req),
    }),

  listPlayerNotes: (id: number | string) =>
    apiFetch<AdminPlayerNotesRes>(`${SPG}/admin/players/${id}/notes`),

  addPlayerNote: (id: number | string, req: AddPlayerNoteReq) =>
    apiFetch<void>(`${SPG}/admin/players/${id}/notes`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  listPlayerAudit: (id: number | string) =>
    apiFetch<AdminPlayerAuditRes>(`${SPG}/admin/players/${id}/audit`),

  // --- P7.4: withdrawal approvals ---
  listWithdrawals: (status: WithdrawalStatus | string) =>
    apiFetch<AdminWithdrawalListRes>(
      `${SPG}/withdrawals?status=${encodeURIComponent(status)}`
    ),

  approveWithdrawal: (id: string) =>
    apiFetch<void>(`${SPG}/withdrawals/${id}/approve`, { method: "POST" }),

  resolveAml: (id: string, req: ResolveAmlReq) =>
    apiFetch<void>(`${SPG}/withdrawals/${id}/aml`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  // --- P7.5: operator payouts ---
  operatorEarnings: () =>
    apiFetch<OperatorEarningsRes>(`${SPG}/operator-payouts/earnings`),

  listOperatorPayouts: () =>
    apiFetch<OperatorPayoutListRes>(`${SPG}/operator-payouts`),

  getOperatorPayout: (id: string) =>
    apiFetch<OperatorPayoutDetailRes>(`${SPG}/operator-payouts/${id}`),

  proposeOperatorPayout: (req: ProposeOperatorPayoutReq) =>
    apiFetch<CreateOperatorPayoutRes>(`${SPG}/operator-payouts`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  approveOperatorPayout: (id: string) =>
    apiFetch<void>(`${SPG}/operator-payouts/${id}/approve`, { method: "POST" }),

  operatorPayoutCallback: (id: string, req: OperatorPayoutCallbackReq) =>
    apiFetch<void>(`${SPG}/operator-payouts/${id}/payout-callback`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  // --- P7.6: payment gateways ---
  listProviders: () => apiFetch<ProvidersListRes>(`${SPG}/admin/providers`),

  createProvider: (req: CreateProviderReq) =>
    apiFetch<CreateProviderRes>(`${SPG}/admin/providers`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  updateProvider: (id: string, req: UpdateProviderReq) =>
    apiFetch<UpdateProviderRes>(`${SPG}/admin/providers/${id}`, {
      method: "PUT",
      body: JSON.stringify(req),
    }),

  // --- P7.8: vendor activation ---
  // BFF special route (not /api/spg/*): GET /api/games/vendors returns providers
  // + per-tenant enabled flag; POST /api/games/vendors/toggle flips it.
  listVendors: () => apiFetch<VendorsRes>("/api/games/vendors"),

  toggleVendor: (req: ToggleVendorReq) =>
    apiFetch<ToggleVendorRes>("/api/games/vendors/toggle", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  // --- P7.9: merchant self-service (auth surface) ---
  getMerchantProfile: () =>
    apiFetch<MerchantProfileRes>("/api/merchant/profile"),

  updateMerchantProfile: (req: MerchantProfileReq) =>
    apiFetch<MerchantProfileRes>("/api/merchant/profile", {
      method: "PUT",
      body: JSON.stringify(req),
    }),

  addMerchantDomain: (req: AddMerchantDomainReq) =>
    apiFetch<AddMerchantDomainRes>("/api/merchant/domains", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  verifyMerchantDomain: (req: VerifyMerchantDomainReq) =>
    apiFetch<VerifyMerchantDomainRes>(`/api/merchant/domains/${req.id}/verify`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  changeMerchantPassword: (req: MerchantPasswordReq) =>
    apiFetch<MerchantPasswordRes>("/api/merchant/password", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  getMerchantAudit: () =>
    apiFetch<MerchantAuditRes>("/api/merchant/audit"),

  // --- P7.10: recon & reports (SPG admin surface) ---
  reconcilePayouts: () =>
    apiFetch<PayoutReconcileRun>(`${SPG}/admin/reconcile/payouts`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  listPayoutMismatches: () =>
    apiFetch<PayoutMismatchesRes>(`${SPG}/admin/reconcile/payouts/mismatches`),

  getProviderBalance: () =>
    apiFetch<ProviderBalanceRes>(`${SPG}/admin/provider-balance`),

  listDeposits: (params?: { status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    return apiFetch<DepositTransactionsRes>(`${SPG}/admin/transactions?${q}`);
  },

  getPaymentsReport: () =>
    apiFetch<PaymentsReportRes>(`${SPG}/admin/reports/payments`),

  getAutoWDRules: () =>
    apiFetch<AutoWDRulesRes>(`${SPG}/admin/auto-wd/rules`),

  putAutoWDRules: (req: AutoWDRule[]) =>
    apiFetch<void>(`${SPG}/admin/auto-wd/rules`, {
      method: "PUT",
      body: JSON.stringify(req),
    }),

  listAutoWDDecisions: () =>
    apiFetch<AutoWDDecisionsRes>(`${SPG}/admin/auto-wd/decisions`),

  getSwingConfig: () =>
    apiFetch<SwingConfig>(`${SPG}/admin/swing/config`),

  putSwingConfig: (req: SwingConfig) =>
    apiFetch<SwingConfig>(`${SPG}/admin/swing/config`, {
      method: "PUT",
      body: JSON.stringify(req),
    }),

  runSwing: () =>
    apiFetch<SwingRun>(`${SPG}/admin/swing/run`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getSwingHistory: () =>
    apiFetch<SwingHistoryRes>(`${SPG}/admin/swing/history`),

  // --- P7.7: currencies & FX ---
  listCurrencies: () => apiFetch<CurrenciesListRes>(`${SPG}/admin/currencies`),

  upsertCurrency: (req: UpsertCurrencyReq) =>
    apiFetch<UpsertCurrencyRes>(`${SPG}/admin/currencies`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  listFXRates: () => apiFetch<FXRatesListRes>(`${SPG}/admin/fx-rates`),

  setFXRate: (req: SetFXRateReq) =>
    apiFetch<SetFXRateRes>(`${SPG}/admin/fx-rates`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  convertFX: (from: string, to: string, amount: number) =>
    apiFetch<FXConvertRes>(
      `${SPG}/admin/fx/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${amount}`
    ),
};
