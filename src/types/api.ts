/**
 * API types — snake_case to match the Go backend JSON tags exactly.
 * TS/JS identifiers remain camelCase; only transport types mirror the wire.
 */

export type Role = "player" | "merchant_admin" | "staff" | "owner" | "finance" | "auditor" | string;

export type AccountStatus = "pending" | "active" | "suspended" | "closed" | string;

export interface RegisterReq {
  username: string;
  phone_number: string;
  password: string;
  currency?: string;
}

export interface RegisterRes {
  user_id: number;
  username: string;
  currency: string;
  status: AccountStatus;
}

export interface LoginReq {
  identifier: string;
  password: string;
  device_id: string;
}

export interface LoginRes {
  token: string;
  user_id: number;
  username: string;
  currency: string;
  status: AccountStatus;
  role: Role;
  merchant_id: number | null;
  must_change_password: boolean;
  /** Masked client-side for display. Optional: "" when unset, and absent from
   *  sessions stored before the backend started returning it. */
  phone_number?: string;
}

// Live wire shape (verified 2026-08-09 against SPG :8081):
// {"balance":{"available":0,"held":0},"currency":"IDR","user_id":1000001}
export interface BalanceRes {
  user_id: number;
  currency: string;
  balance: {
    available: number;
    held: number;
  };
}

export interface BrandRes {
  found: boolean;
  label: string;
  logo_url: string;
  theme: {
    primary_color?: string;
    /** Named accent palette key — see lib/theme-presets.ts. */
    preset?: string;
    /** Named visual template key — see lib/lobby-templates.ts. */
    template?: string;
    [key: string]: string | undefined;
  };
}

/**
 * A deposit instrument the player may use, as served by GET /v1/me/payment-methods (05A).
 * `code` used to be a hard-coded union here; it is now whatever the platform catalogue and
 * the player's brand offer, so this file no longer decides what exists.
 */
export interface PaymentMethod {
  code: string;
  display_name: string;
  description: string;
  /** False = catalogued but not usable right now; the card renders disabled, not hidden. */
  available: boolean;
  /** One line explaining why, empty when available. Server-authored — never invent copy here. */
  reason: string;
  /**
   * Sub-choices this instrument requires before it can be used — today, WHICH BANK should issue
   * the player's virtual account. Absent for instruments with no such choice.
   *
   * Served by the RAIL that would actually execute the deposit, for the same reason `code` is no
   * longer a union in this file: the client renders what the platform offers and never decides
   * what exists. The vendor adding a bank is then a config change, not a client release.
   */
  banks?: string[] | null;
}

export interface PaymentMethodsRes {
  items: PaymentMethod[] | null;
}

export interface DepositReq {
  user_id: number;
  amount: number;
  currency?: string;
  /** One of the codes served by GET /v1/me/payment-methods — no longer a client-side union. */
  method: string;
  client_ref: string;
  /**
   * The player's sub-choice within the instrument — which bank issues their virtual account.
   * Optional: omitted, the rail uses its configured default. Only sent for a method that
   * actually offers `banks`.
   */
  bank?: string;
}

/**
 * The receiving account a MANUAL deposit must be paid into (05C). Present only when the
 * chosen method is settled by a human — its presence is what tells this client to render
 * transfer instructions and a "saya sudah transfer" form instead of waiting for a callback
 * that will never come.
 */
export interface ManualDestination {
  account_id: number;
  method_code?: string;
  bank_code: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  instructions?: string;
  display: string;
}

export interface DepositRes {
  transaction_id: string;
  provider_id: string;
  provider_ref: string;
  va_number?: string;
  amount: number;
  fee: number;
  total_charge: number;
  status: string;
  replayed: boolean;
  manual?: ManualDestination;
}

/** The verification ticket's own state, carried on the deposit status read (05C). */
export interface ManualTicket {
  claim_id: number;
  /** awaiting_proof | pending_review | reviewing | approved | rejected | cancelled */
  status: string;
  amount: number;
  destination?: ManualDestination;
  submitted_at?: string;
  reviewed_at?: string;
  reason?: string;
  /** On a rejected ticket whose money really arrived: 'refund_pending' while it is being
   *  sent back to the sender's account, 'refunded' once it has been. */
  refund_status?: string;
}

/** What the player claims about their transfer. Evidence for an operator, never matched. */
export interface ManualProofReq {
  sender_name: string;
  sender_bank: string;
  sender_account: string;
  reference?: string;
  note?: string;
  transferred_at?: string;
}

export interface DepositStatusRes extends DepositRes {
  /** Present while this deposit is on the manual rail — see ManualTicket. */
  manual_ticket?: ManualTicket;
}

export type DepositStatus = "PENDING" | "SUBMITTED" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";

// --- P4: Games catalog & launch ---
// Verified live (2026-08-09): GET /api/games/catalog →
// {games:[{id,vendor_id,game_code,name,category,min_bet,max_bet,status}]}

export interface Game {
  id: string;
  vendor_id: string;
  game_code: string;
  name: string;
  category: string;
  min_bet: number;
  max_bet: number;
  status: string;
  /** Optional fields — backend may provide these for richer display. */
  image_url?: string;
  rtp?: number;
  description?: string;
  is_featured?: boolean;
  is_popular?: boolean;
  /**
   * True when the game can be opened in free play (vendor-side play money, no wallet).
   * Advisory: the launch route is authoritative and refuses a demo launch the catalog
   * did not flag. Absent on older backends — treat undefined as false.
   */
  demo_supported?: boolean;
  is_new?: boolean;
}

export interface CatalogRes {
  games: Game[];
}

export interface Vendor {
  id: string;
  name: string;
  status: string;
  enabled: boolean;
}

export interface VendorsRes {
  vendors: Vendor[];
}

/** POST /api/games/vendors/toggle — wire shape (assumed, not live-verified). */
export interface ToggleVendorReq {
  vendor_id: string;
  enabled: boolean;
}

export interface ToggleVendorRes {
  vendor_id: string;
  enabled: boolean;
}

// --- P7.9: Merchant self-service (merchant admin) ---
// Endpoint inventory: docs/03-ADMIN-SURFACES.md §3.2:
// GET/PUT /api/merchant/profile
// POST /api/merchant/domains
// POST /api/merchant/domains/:id/verify
// POST /api/merchant/password
// GET /api/merchant/audit
// Wire shapes are NOT live-verified — follow documented backend conventions.

export interface MerchantProfile {
  merchant_id: number;
  name: string;
  logo_url: string;
  theme: {
    primary_color?: string;
    secondary_color?: string;
    [key: string]: string | undefined;
  };
  domains?: MerchantDomain[];
  created_at?: string;
  updated_at?: string;
}

export interface MerchantDomain {
  id: string;
  domain: string;
  status: "pending" | "verified" | "failed";
  dns_txt_record?: string; // TXT record value to create for verification
  created_at?: string;
  verified_at?: string | null;
}

export interface MerchantProfileReq {
  name: string;
  logo_url: string;
  theme: {
    primary_color?: string;
    secondary_color?: string;
  };
}

export interface MerchantProfileRes {
  merchant_id: number;
  name: string;
  logo_url: string;
  theme: {
    primary_color?: string;
    secondary_color?: string;
    [key: string]: string | undefined;
  };
  domains?: MerchantDomain[];
  created_at?: string;
  updated_at?: string;
}

export interface AddMerchantDomainReq {
  domain: string;
}

export interface AddMerchantDomainRes {
  id: string;
  domain: string;
  status: "pending" | "verified" | "failed";
  dns_txt_record?: string;
  created_at?: string;
}

export interface VerifyMerchantDomainReq {
  id: string;
}

export interface VerifyMerchantDomainRes {
  id: string;
  verified: boolean;
  status: "pending" | "verified" | "failed";
}

export interface MerchantPasswordReq {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface MerchantPasswordRes {
  ok: boolean;
}

export interface MerchantAuditEntry {
  id: string;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
  created_at?: string;
}

export interface MerchantAuditRes {
  entries: MerchantAuditEntry[];
}

// --- P7.10: Recon & reports (merchant admin) ---
// Endpoint inventory: docs/03-ADMIN-SURFACES.md §3.1:
// POST /v1/admin/reconcile/payouts
// GET /v1/admin/reconcile/payouts/mismatches
// GET /v1/admin/provider-balance
// GET /v1/admin/transactions
// GET /v1/admin/reports/payments
// GET/PUT /v1/admin/auto-wd/rules + decisions log
// GET/PUT /v1/admin/swing/config + run + history
// Wire shapes are NOT live-verified — follow documented backend conventions.

// Payout reconciliation
export interface PayoutReconcileRun {
  id: string;
  started_at?: string;
  completed_at?: string | null;
  total_payouts?: number;
  mismatches_found?: number;
  status?: "running" | "completed" | "failed";
}

export interface PayoutMismatch {
  id: string;
  transaction_id: string;
  player_username?: string;
  amount?: number;
  currency?: string;
  reason?: string;
  created_at?: string;
}

export interface PayoutMismatchesRes {
  mismatches: PayoutMismatch[];
  total?: number;
}

// Provider balance (float sanity check)
export interface ProviderBalance {
  provider_id: string;
  balance?: number;
  currency?: string;
  status?: "healthy" | "low" | "critical";
}

export interface ProviderBalanceRes {
  providers: ProviderBalance[];
}

// Deposit monitor (transaction listing)
export interface DepositTransaction {
  id: string;
  player_username?: string;
  amount: number;
  currency?: string;
  status: string;
  method?: string;
  created_at?: string;
  completed_at?: string | null;
}

export interface DepositTransactionsRes {
  transactions: DepositTransaction[];
  total?: number;
}

// Payments report
export interface PaymentReportSummary {
  period?: string;
  total_deposits?: number;
  total_withdrawals?: number;
  total_fees?: number;
  net_revenue?: number;
  currency?: string;
}

export interface PaymentsReportRes {
  summary: PaymentReportSummary;
  by_method?: Array<{
    method: string;
    count: number;
    total_amount: number;
  }>;
}

// Auto-WD rules
export interface AutoWDRule {
  id: string;
  name?: string;
  enabled: boolean;
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  player_segment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AutoWDRulesRes {
  rules: AutoWDRule[];
  total?: number;
}

export interface AutoWDDecision {
  id: string;
  rule_id?: string;
  player_username?: string;
  amount?: number;
  decision?: "approved" | "rejected";
  reason?: string;
  created_at?: string;
}

export interface AutoWDDecisionsRes {
  decisions: AutoWDDecision[];
  total?: number;
}

// Swing config
export interface SwingConfig {
  enabled: boolean;
  strategy?: "round_robin" | "weighted" | "performance";
  rebalance_interval_minutes?: number;
  providers?: Array<{
    provider_id: string;
    weight?: number;
    max_balance?: number;
  }>;
}

export interface SwingRun {
  id: string;
  started_at?: string;
  completed_at?: string | null;
  rebalanced_providers?: number;
  status?: "running" | "completed" | "failed";
}

export interface SwingHistoryRes {
  runs: SwingRun[];
  total?: number;
}

export interface LaunchReq {
  game_id: string;
  language?: string;
  country?: string;
  currency?: string;
  /** Free play: vendor play money, no wallet, no ledger. Still requires a session (tier T0). */
  demo?: boolean;
}

export interface LaunchRes {
  game_id: string;
  launch_url: string;
  /** Echoed back on a free-play launch, so the opener can label the window. */
  demo?: boolean;
}

// --- P4: Payout destinations & withdrawals ---
// Verified live (2026-08-09): GET /api/spg/v1/payout-destinations →
// {destinations:[{id,user_id,kind,bank_code,masked_account,AddedAt,usable_after,VerifiedAt,Revoked}]}
// Note: AddedAt/VerifiedAt/Revoked use Go's default (PascalCase) JSON keys.

export interface PayoutDestination {
  id: string;
  user_id: number;
  kind: "bank" | "ewallet" | string;
  bank_code: string;
  masked_account: string;
  AddedAt: string;
  usable_after: string;
  VerifiedAt: string | null;
  Revoked: boolean;
}

export interface DestinationsRes {
  destinations: PayoutDestination[];
}

export interface AddDestinationReq {
  kind: "bank" | "ewallet";
  bank_code: string;
  account: string;
}

export interface AddDestinationRes {
  id: string;
  masked_account: string;
  usable_after: string;
}

export type WithdrawalStatus = "PENDING_APPROVAL" | "AML_HOLD" | "PAYING" | "PAID" | "REFUNDED";

export interface CreateWithdrawalReq {
  user_id: number;
  amount: number;
  client_ref: string;
  destination_id: string;
}

export interface WithdrawalRes {
  id: string;
  user_id?: number;
  amount: number;
  status: WithdrawalStatus | string;
  client_ref?: string;
  destination_id?: string;
  replayed?: boolean;
}

// --- P7: Merchant admin ---
// Endpoint inventory: docs/03-ADMIN-SURFACES.md §3.1.
// NOTE: unlike the player-surface types above, these wire shapes were NOT yet
// verified against a live response (backend repo not at hand) — they follow the
// documented backend conventions (snake_case keys, integer minor units for
// money). Verify against a live tenant during P7 QA; the mappers in
// src/lib/admin-dashboard.ts coerce missing/invalid fields to zero so drift
// degrades to "zeros", never a crash.

/** GET /api/spg/v1/admin/dashboard — KPI summary for the session's tenant. */
export interface AdminDashboardRes {
  currency: string;
  players_total: number;
  players_active_today: number;
  deposits_today_count: number;
  deposits_today_amount: number;
  withdrawals_today_count: number;
  withdrawals_today_amount: number;
  /** Withdrawals awaiting action (PENDING_APPROVAL + AML_HOLD). */
  withdrawals_pending_count: number;
  /** Signed integer minor units; negative = house down. */
  house_pnl_today: number;
}

/** One day bucket of GET /api/spg/v1/admin/reports/dashboard-series. */
export interface DashboardSeriesPoint {
  /** YYYY-MM-DD. */
  date: string;
  /** Integer minor units summed for the day. */
  deposits: number;
  withdrawals: number;
  /** deposits - withdrawals (signed). */
  net: number;
}

/** GET /api/spg/v1/admin/reports/dashboard-series — time series for charts. */
export interface DashboardSeriesRes {
  currency: string;
  days: number;
  points: DashboardSeriesPoint[];
}

// --- P7.3: Players (merchant admin) ---
// Endpoint inventory: docs/03-ADMIN-SURFACES.md §3.1. Same caveat as the
// dashboard types above: wire shapes not yet live-verified; the mappers in
// src/lib/admin-players.ts coerce defensively so drift degrades to
// zeros/empty, never a crash.

/** One row of GET /api/spg/v1/admin/players (directory). */
export interface AdminPlayerSummary {
  user_id: number;
  username: string;
  phone_number?: string;
  currency: string;
  status: AccountStatus;
  /** Lifetime totals, integer minor units. */
  total_deposits?: number;
  total_withdrawals?: number;
  created_at?: string;
  last_login_at?: string | null;
}

/**
 * GET /api/spg/v1/admin/players — server-paginated directory.
 * Query params (assumed, docs don't pin names): ?page=&limit=&search=&status=.
 * Response envelope assumed { players, total, page, limit }.
 */
export interface AdminPlayerListRes {
  players: AdminPlayerSummary[];
  total: number;
  page: number;
  limit: number;
}

/** Read-only wallet balance embedded in the 360 profile (I1: never editable). */
export interface AdminPlayerBalance {
  available: number;
  held: number;
}

/** Lifetime play statistics embedded in the 360 profile. */
export interface AdminPlayerStats {
  total_deposits?: number;
  total_withdrawals?: number;
  total_bets?: number;
  total_wins?: number;
  bet_count?: number;
  last_active_at?: string | null;
}

/** RG limits — integer minor units; null/0 = no limit. */
export interface AdminPlayerLimits {
  daily_deposit_limit?: number | null;
  weekly_deposit_limit?: number | null;
  monthly_deposit_limit?: number | null;
}

/** Compliance snapshot embedded in the 360 profile. */
export interface AdminPlayerCompliance {
  frozen?: boolean;
  self_excluded_until?: string | null;
  limits?: AdminPlayerLimits;
  aml_flags?: string[];
}

/** GET /api/spg/v1/admin/players/:id — 360° profile. */
export interface AdminPlayerProfileRes {
  user_id: number;
  username: string;
  phone_number?: string;
  currency: string;
  status: AccountStatus;
  created_at?: string;
  last_login_at?: string | null;
  balance?: AdminPlayerBalance;
  stats?: AdminPlayerStats;
  compliance?: AdminPlayerCompliance;
  pending_withdrawals?: AdminWithdrawal[];
}

/** PUT /api/spg/v1/admin/players/:id/limits — set RG deposit limits. */
export interface SetPlayerLimitsReq {
  daily_deposit_limit: number | null;
  weekly_deposit_limit: number | null;
  monthly_deposit_limit: number | null;
}

/** POST /api/spg/v1/admin/players/:id/self-exclude — duration in days. */
export interface SelfExcludeReq {
  duration_days: number;
}

/** PUT /api/spg/v1/admin/players/:id/status — lifecycle transition. */
export interface SetPlayerStatusReq {
  status: "active" | "suspended" | "closed";
}

/** One note of GET /api/spg/v1/admin/players/:id/notes. */
export interface AdminPlayerNote {
  id: string | number;
  author?: string;
  note: string;
  created_at?: string;
}

export interface AdminPlayerNotesRes {
  notes: AdminPlayerNote[];
}

/** POST /api/spg/v1/admin/players/:id/notes — add a note. */
export interface AddPlayerNoteReq {
  note: string;
}

/** One entry of GET /api/spg/v1/admin/players/:id/audit. */
export interface AdminPlayerAuditEntry {
  id: string | number;
  action: string;
  actor?: string;
  detail?: string;
  created_at?: string;
}

export interface AdminPlayerAuditRes {
  entries: AdminPlayerAuditEntry[];
}

/**
 * POST /api/spg/v1/admin/players — manual registration. Body mirrors the
 * documented public register contract (docs/02-API-CONTRACTS.md §2.1).
 */
export interface AdminRegisterPlayerReq {
  username: string;
  phone_number: string;
  password: string;
  currency?: string;
}

// --- P7.4: Withdrawal approvals (merchant admin) ---
// States documented in docs/02-API-CONTRACTS.md §2:
// PENDING_APPROVAL → (optionally AML_HOLD) → PAYING → PAID | REFUNDED.

/** One queue row of GET /api/spg/v1/withdrawals?status=… */
export interface AdminWithdrawal {
  id: string;
  user_id: number;
  username?: string;
  /** Integer minor units. */
  amount: number;
  currency: string;
  status: WithdrawalStatus | string;
  /** Masked destination summary (e.g. "BCA ****1234") — never full numbers. */
  destination?: string;
  destination_id?: string;
  requested_at?: string;
  aml_flags?: string[];
  client_ref?: string;
}

/** GET /api/spg/v1/withdrawals?status=… — queue listing. */
export interface AdminWithdrawalListRes {
  withdrawals: AdminWithdrawal[];
  total?: number;
}

/**
 * POST /api/spg/v1/withdrawals/:id/aml — resolve an AML hold.
 * Body shape is NOT documented — assumed { decision, note } where
 * "release" continues the payout and "reject" refunds the player.
 */
export interface ResolveAmlReq {
  decision: "release" | "reject";
  note?: string;
}

// --- P7.5: Operator payouts (merchant admin) ---
// Endpoint inventory: docs/03-ADMIN-SURFACES.md §3.1:
// GET /v1/operator-payouts/earnings
// GET /v1/operator-payouts[/:id]
// POST /v1/operator-payouts 🔒fresh
// POST /v1/operator-payouts/:id/approve 🔒fresh
// POST /v1/operator-payouts/:id/payout-callback

/** Earnings overview for the operator house wallet. */
export interface OperatorEarningsRes {
  currency: string;
  /** Integer minor units, signed (house balance). */
  available_balance: number;
  /** Integer minor units, signed (YTD or period-to-date). */
  pnl_ytd: number;
  /** Integer minor units, signed (total withdrawn by players this month). */
  withdrawals_this_month: number;
  /** ISO date string, e.g. "2026-08-09". */
  effective_date: string;
}

/** One payout row in the history table. */
export interface OperatorPayoutRow {
  id: string;
  user_id: number;
  username: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  proposed_by?: string;
  proposed_at?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  result?: string | null;
  reference_no?: string | null;
  callback_at?: string | null;
}

/** GET /v1/operator-payouts — history listing. */
export interface OperatorPayoutListRes {
  payouts: OperatorPayoutRow[];
  total?: number;
}

/** GET /v1/operator-payouts/:id — detail view. */
export interface OperatorPayoutDetailRes {
  id: string;
  user_id: number;
  username: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  destination_ref?: string;
  proposed_by?: string;
  proposed_at?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  result?: string | null;
  reference_no?: string | null;
  callback_at?: string | null;
  rejection_reason?: string;
}

/**
 * POST /v1/operator-payouts — propose a new operator payout.
 * Amount is integer minor units. `method` reflects the backend's configured
 * payout methods (e.g. "bank_transfer", "ewallet"). `destination` is a string
 * ref (account number/ID) — never raw credentials.
 */
export interface ProposeOperatorPayoutReq {
  amount: number;
  method: string;
  destination: string;
  client_ref: string;
}

/** POST /v1/operator-payouts — create response. */
export interface CreateOperatorPayoutRes {
  id: string;
  user_id: number;
  amount: number;
  status: string;
  client_ref?: string;
  replayed?: boolean;
}

/**
 * POST /:id/payout-callback — mark a payout with its final result/reference.
 * Shape assumed from docs; actual keys TBD on live verification.
 */
export interface OperatorPayoutCallbackReq {
  result: string;
  reference_no?: string;
}

// --- P7.6: Payment gateways (merchant admin) ---
// Endpoint inventory: docs/03-ADMIN-SURFACES.md §3.1:
// GET /v1/admin/providers
// POST /v1/admin/providers
// PUT /v1/admin/providers/:id

/** Payment adapter names supported by the backend. */
export type PaymentAdapter = "mock" | "otomatis" | string;

/** One provider row in the gateways list. */
export interface ProviderRow {
  id: string;
  adapter: PaymentAdapter;
  /** Free-form JSONB config (endpoints, merchant_uuid, client_name, credentials refs). */
  config: Record<string, unknown>;
  status: "active" | "disabled" | string;
  created_at?: string;
  updated_at?: string;
}

/** GET /v1/admin/providers — gateway list. */
export interface ProvidersListRes {
  providers: ProviderRow[];
  total?: number;
}

/** Credential reference format: ^(env|file|vault|dev):NAME — never raw secrets. */
export type CredentialRef = string & { readonly __credential_ref: unique symbol };

/**
 * POST /v1/admin/providers — create a new provider.
 * Config is JSONB; credential fields must be refs (env:/file:/vault:/dev:).
 */
export interface CreateProviderReq {
  adapter: PaymentAdapter;
  config: Record<string, unknown>;
  status?: "active" | "disabled";
}

/** POST /v1/admin/providers — create response. */
export interface CreateProviderRes {
  id: string;
  adapter: PaymentAdapter;
  status: string;
}

/** PUT /v1/admin/providers/:id — update provider config. */
export interface UpdateProviderReq {
  adapter?: PaymentAdapter;
  config?: Record<string, unknown>;
  status?: "active" | "disabled";
}

/** PUT /v1/admin/providers/:id — update response. */
export interface UpdateProviderRes {
  id: string;
  updated: boolean;
}

// --- P7.7: Currencies & FX (merchant admin) ---
// Endpoint inventory: docs/03-ADMIN-SURFACES.md §3.1:
// GET/POST /v1/admin/currencies
// POST /v1/admin/fx-rates
// GET /v1/admin/fx/convert?from&to&amount

/** One currency row in the list. */
export interface CurrencyRow {
  code: string;
  name: string;
  symbol?: string;
  decimals: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** GET /v1/admin/currencies — currency list. */
export interface CurrenciesListRes {
  currencies: CurrencyRow[];
  total?: number;
}

/**
 * POST /v1/admin/currencies — upsert a currency (create or update by code).
 */
export interface UpsertCurrencyReq {
  code: string;
  name: string;
  symbol?: string;
  decimals: number;
  is_active?: boolean;
}

/** POST /v1/admin/currencies — upsert response. */
export interface UpsertCurrencyRes {
  code: string;
  updated: boolean;
}

/** FX rate entry. Rate is effective-dated, not retroactive. */
export interface FXRateRow {
  from_currency: string;
  to_currency: string;
  /** Exchange rate as decimal (e.g. 15500.00 for USD→IDR). */
  rate: number;
  /** Effective from date (ISO). Rates apply from this date forward. */
  effective_from: string;
  created_at?: string;
  updated_at?: string;
}

/** GET /v1/admin/fx-rates — FX rate history. */
export interface FXRatesListRes {
  rates: FXRateRow[];
  total?: number;
}

/**
 * POST /v1/admin/fx-rates — set a new FX rate.
 * Rate is effective from the given date (not retroactive).
 */
export interface SetFXRateReq {
  from_currency: string;
  to_currency: string;
  rate: number;
  /** Effective date (ISO 8601 date string). */
  effective_from: string;
}

/** POST /v1/admin/fx-rates — response. */
export interface SetFXRateRes {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_from: string;
}

/** GET /v1/admin/fx/convert — preview conversion result. */
export interface FXConvertRes {
  from_currency: string;
  to_currency: string;
  amount: number;
  /** Converted amount, integer minor units. */
  converted: number;
  /** Applied rate. */
  rate: number;
  /** Effective date of the rate used. */
  effective_date?: string;
}
