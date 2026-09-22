import { describe, it, expect } from "vitest";
import {
  toCurrencyList,
  validateCurrencyForm,
  validateFXRateForm,
  roundHalfUp,
  formatCurrencyAmount,
} from "./admin-currencies";
import type { CurrenciesListRes, CurrencyRow } from "@/types/api";

const mockCurrencies: CurrenciesListRes = {
  currencies: [
    { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 0, is_active: true },
    { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, is_active: true },
    { code: "SJP", name: "Invalid Code", symbol: "?", decimals: -1, is_active: false },
  ],
  total: 3,
};

describe("roundHalfUp", () => {
  it("rounds half-up correctly", () => {
    expect(roundHalfUp(1.5)).toBe(2);
    expect(roundHalfUp(1.4)).toBe(1);
    expect(roundHalfUp(1.50)).toBe(2);
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(-0.5)).toBe(0);
    expect(roundHalfUp(10.5)).toBe(11);
  });

  it("handles large numbers", () => {
    expect(roundHalfUp(1_500_000.5)).toBe(1_500_001);
  });
});

describe("toCurrencyList", () => {
  it("normalizes the list", () => {
    const view = toCurrencyList(mockCurrencies);
    expect(view.rows.length).toBe(3);
    expect(view.rows[0]?.code).toBe("IDR");
    expect(view.rows[1]?.code).toBe("USD");
    expect(view.total).toBe(3);
  });

  it("handles malformed entries gracefully", () => {
    const bad: CurrencyRow = {
      code: "SJP",
      name: "Invalid",
      symbol: "?",
      decimals: -1, // negative → coerces to 0
      is_active: false,
    };
    const res = toCurrencyList({ currencies: [bad] });
    expect(res.rows[0]?.decimals).toBe(0); // defaults to 0
  });

  it("returns empty for undefined", () => {
    const view = toCurrencyList(undefined);
    expect(view.rows).toEqual([]);
    expect(view.total).toBe(0);
  });
});

describe("validateCurrencyForm", () => {
  const baseInput = {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    decimals: 2,
    is_active: true,
  };

  it("accepts valid input", () => {
    const res = validateCurrencyForm(baseInput);
    expect(res.error).toBeNull();
    expect(res.req?.code).toBe("EUR");
    expect(res.req?.name).toBe("Euro");
  });

  it("rejects invalid code (not 3 letters)", () => {
    expect(validateCurrencyForm({ ...baseInput, code: "EU" }).error).toContain("3 uppercase letters");
    expect(validateCurrencyForm({ ...baseInput, code: "Euros" }).error).toContain("3 uppercase letters");
    expect(validateCurrencyForm({ ...baseInput, code: "euro" }).error).toContain("3 uppercase letters");
  });

  it("uppercases the code", () => {
    const res = validateCurrencyForm({ ...baseInput, code: "eur" });
    expect(res.req?.code).toBe("EUR");
  });

  it("requires non-empty name", () => {
    expect(validateCurrencyForm({ ...baseInput, name: "" }).error).toBe("Currency name is required.");
  });

  it("rejects decimals outside 0-8", () => {
    expect(validateCurrencyForm({ ...baseInput, decimals: -1 }).error).toBe("Decimals must be an integer between 0 and 8.");
    expect(validateCurrencyForm({ ...baseInput, decimals: 9 }).error).toBe("Decimals must be an integer between 0 and 8.");
  });

  it("rejects decimal as non-integer", () => {
    expect(validateCurrencyForm({ ...baseInput, decimals: 2.5 }).error).toBe("Decimals must be an integer between 0 and 8.");
  });
});

describe("validateFXRateForm", () => {
  const baseInput = {
    from_currency: "USD",
    to_currency: "IDR",
    rate: "15500.00",
    effective_from: "2026-08-09",
  };

  it("accepts valid input", () => {
    const res = validateFXRateForm(baseInput);
    expect(res.error).toBeNull();
    expect(res.req?.from_currency).toBe("USD");
    expect(res.req?.rate).toBe(15500.00);
  });

  it("uppercases currency codes", () => {
    const res = validateFXRateForm({ ...baseInput, from_currency: "usd" });
    expect(res.req?.from_currency).toBe("USD");
  });

  it("rejects same from/to currencies", () => {
    const res = validateFXRateForm({ ...baseInput, to_currency: "USD" });
    expect(res.error).toBe("From and to currencies must differ.");
  });

  it("rejects invalid currency codes", () => {
    expect(validateFXRateForm({ ...baseInput, from_currency: "US" }).error).toContain("valid 3-letter code");
    expect(validateFXRateForm({ ...baseInput, to_currency: "IDR-RP" }).error).toContain("valid 3-letter code");
  });

  it("rejects non-positive rate", () => {
    expect(validateFXRateForm({ ...baseInput, rate: "0" }).error).toContain("positive number");
    expect(validateFXRateForm({ ...baseInput, rate: "-100" }).error).toContain("positive number");
    expect(validateFXRateForm({ ...baseInput, rate: "abc" }).error).toContain("positive number");
  });

  it("validates effective date format YYYY-MM-DD", () => {
    expect(validateFXRateForm({ ...baseInput, effective_from: "" }).error).toBe("Effective date is required.");
    expect(validateFXRateForm({ ...baseInput, effective_from: "2026/08/09" }).error).toBe("Effective date must be in YYYY-MM-DD format.");
    expect(validateFXRateForm({ ...baseInput, effective_from: "invalid" }).error).toBe("Effective date must be in YYYY-MM-DD format.");
  });

  it("accepts valid dates like today and future", () => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(validateFXRateForm({ ...baseInput, effective_from: today }).error).toBeNull();
    expect(validateFXRateForm({ ...baseInput, effective_from: tomorrow }).error).toBeNull();
  });
});

describe("formatCurrencyAmount", () => {
  it("formats IDR with no decimals", () => {
    expect(formatCurrencyAmount(1_500_000, "IDR")).toBe("Rp1,500,000");
    expect(formatCurrencyAmount(0, "IDR")).toBe("Rp0");
  });

  it("formats USD with 2 decimals", () => {
    expect(formatCurrencyAmount(100, "USD")).toBe("$1.00");
    expect(formatCurrencyAmount(123456, "USD")).toBe("$1,234.56");
  });
});
