import { describe, it, expect } from "vitest";
import { formatMoney, validateAutoWDRule, validateSwingConfig } from "./admin-reports";

describe("formatMoney", () => {
  it("formats IDR amounts correctly", () => {
    const formatted = formatMoney(100000, "IDR");
    expect(formatted).toContain("100.000");
  });

  it("formats USD amounts correctly", () => {
    const formatted = formatMoney(1000, "USD");
    expect(formatted).toContain("1.000"); // Indonesian locale uses periods for thousands
  });

  it("handles zero amounts", () => {
    const formatted = formatMoney(0, "IDR");
    expect(formatted).toContain("0");
  });

  it("uses default currency when not provided", () => {
    const formatted = formatMoney(50000);
    expect(formatted).toContain("50.000");
  });
});

describe("validateAutoWDRule", () => {
  it("validates valid rule", () => {
    const result = validateAutoWDRule({
      name: "Auto WD Rule",
      enabled: true,
      min_amount: "10000",
      max_amount: "1000000",
      currency: "IDR",
      player_segment: "all",
    });
    expect(result.error).toBeNull();
    expect(result.rule).toBeDefined();
    expect(result.rule?.name).toBe("Auto WD Rule");
    expect(result.rule?.enabled).toBe(true);
    expect(result.rule?.min_amount).toBe(10000);
    expect(result.rule?.max_amount).toBe(1000000);
  });

  it("rejects empty name", () => {
    const result = validateAutoWDRule({
      name: "",
      enabled: true,
      min_amount: "10000",
      max_amount: "1000000",
      currency: "IDR",
      player_segment: "all",
    });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("required");
  });

  it("rejects invalid min amount", () => {
    const result = validateAutoWDRule({
      name: "Rule",
      enabled: true,
      min_amount: "invalid",
      max_amount: "1000000",
      currency: "IDR",
      player_segment: "all",
    });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Minimum amount");
  });

  it("rejects negative min amount", () => {
    const result = validateAutoWDRule({
      name: "Rule",
      enabled: true,
      min_amount: "-1000",
      max_amount: "1000000",
      currency: "IDR",
      player_segment: "all",
    });
    expect(result.error).toBeDefined();
  });
});

describe("validateSwingConfig", () => {
  it("validates valid config", () => {
    const result = validateSwingConfig({
      enabled: true,
      strategy: "round_robin",
      rebalanceIntervalMinutes: "60",
    });
    expect(result.error).toBeNull();
    expect(result.req).toBeDefined();
    expect(result.req?.enabled).toBe(true);
    expect(result.req?.strategy).toBe("round_robin");
    expect(result.req?.rebalance_interval_minutes).toBe(60);
  });

  it("rejects invalid interval", () => {
    const result = validateSwingConfig({
      enabled: true,
      strategy: "round_robin",
      rebalanceIntervalMinutes: "invalid",
    });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("positive integer");
  });

  it("rejects zero interval", () => {
    const result = validateSwingConfig({
      enabled: true,
      strategy: "round_robin",
      rebalanceIntervalMinutes: "0",
    });
    expect(result.error).toBeDefined();
  });

  it("rejects negative interval", () => {
    const result = validateSwingConfig({
      enabled: true,
      strategy: "round_robin",
      rebalanceIntervalMinutes: "-60",
    });
    expect(result.error).toBeDefined();
  });
});
