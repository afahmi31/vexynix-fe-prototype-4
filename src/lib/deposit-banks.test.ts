import { describe, expect, it } from "vitest";
import { bankOptionsFor, validateBankChoice } from "@/lib/deposit-banks";
import type { PaymentMethod } from "@/types/api";

const method = (code: string, banks?: string[] | null): PaymentMethod => ({
  code,
  display_name: code.toUpperCase(),
  description: "",
  available: true,
  reason: "",
  ...(banks === undefined ? {} : { banks }),
});

const methods = [
  method("qris"),
  method("va", ["BCA", "BNI", "MANDIRI"]),
];

describe("bankOptionsFor", () => {
  it("returns the banks the chosen instrument offers", () => {
    expect(bankOptionsFor(methods, "va")).toEqual(["BCA", "BNI", "MANDIRI"]);
  });

  // QRIS is paid by scanning; there is no bank to choose, and rendering a picker for it would
  // invent a decision the player does not have to make.
  it("returns nothing for an instrument with no bank choice", () => {
    expect(bankOptionsFor(methods, "qris")).toEqual([]);
  });

  // The list is loaded asynchronously and a method can be selected before it arrives, so every
  // absent shape has to resolve to "no picker" rather than throwing on the deposit screen.
  it("survives a missing list, an unknown method and an explicit null", () => {
    expect(bankOptionsFor(null, "va")).toEqual([]);
    expect(bankOptionsFor(undefined, "va")).toEqual([]);
    expect(bankOptionsFor(methods, "")).toEqual([]);
    expect(bankOptionsFor(methods, "nope")).toEqual([]);
    expect(bankOptionsFor([method("va", null)], "va")).toEqual([]);
  });
});

describe("validateBankChoice", () => {
  // The rule that matters: a bank is REQUIRED once offered. Silently defaulting would hand a
  // player a virtual account at a bank they may not hold an account with.
  it("requires a choice when the instrument offers one", () => {
    expect(validateBankChoice(["BCA", "BNI"], "")).toBe("Pilih bank tujuan");
    expect(validateBankChoice(["BCA", "BNI"], "BCA")).toBeNull();
  });

  it("rejects a bank the instrument does not offer", () => {
    expect(validateBankChoice(["BCA", "BNI"], "JAGO")).toBe(
      "Bank tersebut tidak tersedia",
    );
  });

  it("accepts no bank when the instrument offers none", () => {
    expect(validateBankChoice([], "")).toBeNull();
  });

  // Reachable only through a stale selection after switching instruments — which is exactly why
  // the page clears the bank on every method change, and why this stays a guarded case.
  it("rejects a leftover bank on an instrument that offers none", () => {
    expect(validateBankChoice([], "BCA")).toBe(
      "Metode ini tidak memerlukan pilihan bank",
    );
  });
});
