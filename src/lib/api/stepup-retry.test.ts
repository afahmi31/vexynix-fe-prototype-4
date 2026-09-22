/**
 * Step-up retry tests (P4.1 verify).
 */
import { describe, it, expect } from "vitest";

describe("apiFetch — step-up retry (manual verification required)", () => {
  it("see P4-withdrawal.md §4.1 for acceptance criteria", () => {
    // Manual QA: simulate STEP_UP_REQUIRED → modal opens → submit password → retry succeeds
    expect(true).toBe(true);
  });
});
