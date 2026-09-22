import type { PaymentMethod } from "@/types/api";

/**
 * The bank sub-choice some deposit instruments carry.
 *
 * A virtual account is issued *at* a bank, and which bank is the player's decision — they need the
 * one they actually hold an account with. The rail abcFastpy serves nine, four of which its own
 * document never mentions, so the list is served by the server (`banks` on the payment method)
 * rather than living here: the same rule 05A set when it removed the hard-coded
 * `"qris" | "va"` union from this client. A bank the vendor adds then appears with no release, and
 * one they drop stops being offered the same day.
 *
 * These two helpers are the whole rule, kept out of the page component so they can be tested
 * directly — which is how everything else in `lib/` is covered here.
 */

/** The banks the given method offers, or an empty list when it has no such choice (e.g. QRIS). */
export function bankOptionsFor(
  methods: PaymentMethod[] | null | undefined,
  methodCode: string,
): string[] {
  if (!methods || !methodCode) return [];
  return methods.find((m) => m.code === methodCode)?.banks ?? [];
}

/**
 * Validates the player's bank choice against what the instrument offers.
 *
 * Returns an error message, or null when the choice is acceptable.
 *
 * Two deliberate rules:
 *  - a method that offers banks REQUIRES one. Defaulting silently is how a player ends up with a
 *    virtual account at a bank they cannot pay from;
 *  - a method that offers none must not carry a bank. That would send the rail a field it did not
 *    ask for, and it can only happen through a stale selection after switching instruments.
 */
export function validateBankChoice(
  options: string[],
  bank: string,
): string | null {
  if (options.length === 0) {
    return bank ? "Metode ini tidak memerlukan pilihan bank" : null;
  }
  if (!bank) return "Pilih bank tujuan";
  if (!options.includes(bank)) return "Bank tersebut tidak tersedia";
  return null;
}
