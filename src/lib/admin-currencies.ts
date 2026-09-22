/**
 * Currencies & FX (P7.7) — pure mapping/validation between the wire types
 * (src/types/api.ts) and the currencies/FX UI.
 *
 * Wire shapes are not live-verified (see types/api.ts) — every accessor
 * coerces defensively so shape drift degrades to zeros/empty, never a crash.
 */
import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";
import type {
  CurrenciesListRes,
  CurrencyRow,
  FXConvertRes,
  FXRateRow,
  FXRatesListRes,
  SetFXRateReq,
  UpsertCurrencyReq,
} from "@/types/api";

/** Common currency codes with their symbols. */
export const CURRENCY_INFO: Record<string, { symbol: string; decimals: number }> = {
  IDR: { symbol: "Rp", decimals: 0 },
  USD: { symbol: "$", decimals: 2 },
  SGD: { symbol: "S$", decimals: 2 },
  MYR: { symbol: "RM", decimals: 2 },
  THB: { symbol: "฿", decimals: 2 },
};

// ---------------------------------------------------------------------------
// Currency list
// ---------------------------------------------------------------------------

export interface CurrencyView {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CurrencyListView {
  rows: CurrencyView[];
  total: number;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toIsoOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Normalize one currency row; null input → undefined. */
export function toCurrencyRow(c: CurrencyRow | undefined): CurrencyView | undefined {
  if (c == null || typeof c !== "object") return undefined;
  const code = toText(c.code).toUpperCase();
  const rawDecimals = toAmount(c.decimals);
  const decimals = rawDecimals >= 0 && rawDecimals <= 8 ? rawDecimals : CURRENCY_INFO[code]?.decimals ?? 0;
  return {
    code,
    name: toText(c.name),
    symbol: toText(c.symbol) || CURRENCY_INFO[code]?.symbol || code,
    decimals,
    isActive: c.is_active === true,
    createdAt: toIsoOrNull(c.created_at),
    updatedAt: toIsoOrNull(c.updated_at),
  };
}

/** Normalize the currencies list; missing/garbage → empty list. */
export function toCurrencyList(res: CurrenciesListRes | undefined): CurrencyListView {
  const list = res?.currencies;
  if (!Array.isArray(list)) return { rows: [], total: 0 };
  const rows = list
    .map(toCurrencyRow)
    .filter((r): r is CurrencyView => r !== undefined);
  const total = toAmount(res?.total) || rows.length;
  return { rows, total };
}

// ---------------------------------------------------------------------------
// Currency form validation
// ---------------------------------------------------------------------------

export interface CurrencyFormInput {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  is_active: boolean;
}

/**
 * Validate the currency upsert form. Code must be 3 letters; name required;
 * decimals 0-8.
 */
export function validateCurrencyForm(input: CurrencyFormInput): {
  req: UpsertCurrencyReq;
  error: null;
} | {
  req: null;
  error: string;
} {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return { req: null, error: "Currency code must be exactly 3 uppercase letters (e.g. IDR)." };
  }
  const name = input.name.trim();
  if (name === "") {
    return { req: null, error: "Currency name is required." };
  }
  if (input.decimals < 0 || input.decimals > 8 || !Number.isInteger(input.decimals)) {
    return { req: null, error: "Decimals must be an integer between 0 and 8." };
  }
  return {
    req: {
      code,
      name,
      symbol: input.symbol.trim(),
      decimals: input.decimals,
      is_active: input.is_active,
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// FX rate form validation
// ---------------------------------------------------------------------------

export interface FXRateFormInput {
  from_currency: string;
  to_currency: string;
  rate: string;
  effective_from: string;
}

/**
 * Validate the FX rate form. Rate must be positive; currencies must differ;
 * effective_from must be a valid date.
 */
export function validateFXRateForm(input: FXRateFormInput): {
  req: SetFXRateReq;
  error: null;
} | {
  req: null;
  error: string;
} {
  const from = input.from_currency.trim().toUpperCase();
  const to = input.to_currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(from)) {
    return { req: null, error: "From currency must be a valid 3-letter code." };
  }
  if (!/^[A-Z]{3}$/.test(to)) {
    return { req: null, error: "To currency must be a valid 3-letter code." };
  }
  if (from === to) {
    return { req: null, error: "From and to currencies must differ." };
  }
  const rateStr = input.rate.trim();
  if (rateStr === "") {
    return { req: null, error: "Rate is required." };
  }
  const rate = Number(rateStr);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { req: null, error: "Rate must be a positive number." };
  }
  const effectiveFrom = input.effective_from.trim();
  if (effectiveFrom === "") {
    return { req: null, error: "Effective date is required." };
  }
  // Validate ISO date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    return { req: null, error: "Effective date must be in YYYY-MM-DD format." };
  }
  const parsedDate = new Date(effectiveFrom);
  if (Number.isNaN(parsedDate.getTime())) {
    return { req: null, error: "Effective date is not a valid date." };
  }
  return {
    req: {
      from_currency: from,
      to_currency: to,
      rate,
      effective_from: effectiveFrom,
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// FX conversion
// ---------------------------------------------------------------------------

export interface FXConvertView {
  from: string;
  to: string;
  amount: number;
  converted: number;
  rate: number;
  effectiveDate: string | null;
  /** Display value with currency formatting. */
  formattedConverted: string;
}

/**
 * Round half-up to integer (per spec: integer rupiah display).
 * Used for display only; server does the actual conversion.
 */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/** Normalize the FX convert response. */
export function toFXConvertView(res: FXConvertRes | undefined): FXConvertView {
  return {
    from: toText(res?.from_currency).toUpperCase(),
    to: toText(res?.to_currency).toUpperCase(),
    amount: toAmount(res?.amount),
    converted: toAmount(res?.converted),
    rate: toAmount(res?.rate),
    effectiveDate: toIsoOrNull(res?.effective_date),
    formattedConverted: `${toText(res?.to_currency).toUpperCase()} ${roundHalfUp(toAmount(res?.converted)).toLocaleString("id-ID")}`,
  };
}

// ---------------------------------------------------------------------------
// FX rates list
// ---------------------------------------------------------------------------

export interface FXRateView {
  from: string;
  to: string;
  rate: number;
  effectiveFrom: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FXRateListView {
  rows: FXRateView[];
  total: number;
}

/** Normalize one FX rate row. */
export function toFXRateRow(r: FXRateRow | undefined): FXRateView | undefined {
  if (r == null || typeof r !== "object") return undefined;
  return {
    from: toText(r.from_currency).toUpperCase(),
    to: toText(r.to_currency).toUpperCase(),
    rate: toAmount(r.rate),
    effectiveFrom: toIsoOrNull(r.effective_from),
    createdAt: toIsoOrNull(r.created_at),
    updatedAt: toIsoOrNull(r.updated_at),
  };
}

/** Normalize the FX rates list. */
export function toFXRateList(res: FXRatesListRes | undefined): FXRateListView {
  const list = res?.rates;
  if (!Array.isArray(list)) return { rows: [], total: 0 };
  const rows = list
    .map(toFXRateRow)
    .filter((r): r is FXRateView => r !== undefined);
  const total = toAmount(res?.total) || rows.length;
  return { rows, total };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map a currency/FX action failure to display copy.
 */
export function mapCurrencyActionError(err: unknown): string {
  if (err === "cancel") return "";
  if (isApiError(err, 403)) {
    return err.message || "You do not have permission to manage currencies.";
  }
  if (isApiError(err, 404)) {
    return "Currency or rate not found.";
  }
  if (isApiError(err, 409)) {
    return err.message || "Conflicting currency state — refresh and try again.";
  }
  if (isApiError(err, 400)) {
    return err.message || "Invalid request — check the form values.";
  }
  if (isApiError(err, 429)) {
    return "Too many attempts — wait a moment and try again.";
  }
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) {
    return "Connection problem — verify the currency state before retrying.";
  }
  if (isApiError(err)) return err.message || "Action failed";
  return "Something went wrong";
}

/**
 * Format an amount with its currency decimals for display.
 * Uses en-US for consistent . separator (id-ID would use , for decimals).
 */
export function formatCurrencyAmount(
  amount: number,
  currency: string
): string {
  const info = CURRENCY_INFO[currency];
  const decimals = info?.decimals ?? 0;
  const symbol = info?.symbol || currency;
  const divisor = Math.pow(10, decimals);
  const value = amount / divisor;
  return `${symbol}${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}
