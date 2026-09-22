import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClientRef } from "./idempotency";

describe("useClientRef", () => {
  it("mints a UUID on mount", () => {
    const { result } = renderHook(() => useClientRef());
    expect(result.current.ref).toBeTruthy();
    expect(typeof result.current.ref).toBe("string");
  });

  it("is stable across re-renders", () => {
    const { result, rerender } = renderHook(() => useClientRef());
    const first = result.current.ref;
    rerender();
    expect(result.current.ref).toBe(first);
  });

  it("reset() mints a new UUID", () => {
    const { result, rerender } = renderHook(() => useClientRef());
    const first = result.current.ref;
    act(() => result.current.reset());
    rerender();
    expect(result.current.ref).not.toBe(first);
  });
});
