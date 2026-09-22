import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/tabsync", () => ({
  postLock: vi.fn(),
  postUnlock: vi.fn(),
  postBalanceUpdate: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

import { postLock, postUnlock } from "@/lib/tabsync";
import {
  useTabSyncStore,
  LOCK_WATCHDOG_MS,
  REMOTE_LOCK_EXPIRY_MS,
} from "./tabsync";

const mockPostLock = vi.mocked(postLock);
const mockPostUnlock = vi.mocked(postUnlock);

describe("tabsync store — transaction lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTabSyncStore.getState()._resetForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    useTabSyncStore.getState()._resetForTests();
  });

  it("withLock posts LOCK, runs fn, returns its result, then posts UNLOCK", async () => {
    const fn = vi.fn(async () => 42);

    const result = await useTabSyncStore.getState().withLock(fn);

    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockPostLock).toHaveBeenCalledTimes(1);
    expect(mockPostLock).toHaveBeenCalledWith(expect.any(String));
    expect(mockPostUnlock).toHaveBeenCalledTimes(1);
    // Lock released afterwards
    expect(useTabSyncStore.getState().lockOwner).toBeNull();
  });

  it("holds the lock while fn is in flight", async () => {
    let resolveFn: (v: string) => void = () => {};
    const pending = new Promise<string>((r) => {
      resolveFn = r;
    });

    const p = useTabSyncStore.getState().withLock(() => pending);
    expect(useTabSyncStore.getState().lockOwner).toBe("me");

    resolveFn("done");
    await expect(p).resolves.toBe("done");
    expect(useTabSyncStore.getState().lockOwner).toBeNull();
  });

  it("same-tab reentrancy: nested withLock runs inline without a second LOCK", async () => {
    const inner = vi.fn(async () => "inner");

    await useTabSyncStore.getState().withLock(async () => {
      const r = await useTabSyncStore.getState().withLock(inner);
      expect(r).toBe("inner");
      // Still holding the outer lock
      expect(useTabSyncStore.getState().lockOwner).toBe("me");
    });

    expect(inner).toHaveBeenCalledTimes(1);
    expect(mockPostLock).toHaveBeenCalledTimes(1);
    expect(mockPostUnlock).toHaveBeenCalledTimes(1);
    expect(useTabSyncStore.getState().lockOwner).toBeNull();
  });

  it("releases the lock (UNLOCK) even when fn throws", async () => {
    const boom = new Error("api failed");

    await expect(
      useTabSyncStore.getState().withLock(async () => {
        throw boom;
      })
    ).rejects.toBe(boom);

    expect(mockPostUnlock).toHaveBeenCalledTimes(1);
    expect(useTabSyncStore.getState().lockOwner).toBeNull();
  });

  it("watchdog auto-unlocks after 30s and the late fn completion does not double-unlock", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    let resolveFn: (v: string) => void = () => {};
    const pending = new Promise<string>((r) => {
      resolveFn = r;
    });

    const p = useTabSyncStore.getState().withLock(() => pending);
    expect(useTabSyncStore.getState().lockOwner).toBe("me");
    expect(mockPostUnlock).not.toHaveBeenCalled();

    // Advance past the watchdog — lock must be released automatically
    await vi.advanceTimersByTimeAsync(LOCK_WATCHDOG_MS);

    expect(mockPostUnlock).toHaveBeenCalledTimes(1);
    expect(useTabSyncStore.getState().lockOwner).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("watchdog")
    );

    // The hung fn finally resolves — its finally block must NOT post a second UNLOCK
    resolveFn("late");
    await expect(p).resolves.toBe("late");
    expect(mockPostUnlock).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it("watchdog does not fire for a lock released before 30s", async () => {
    vi.useFakeTimers();

    await useTabSyncStore.getState().withLock(async () => "fast");
    expect(mockPostUnlock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(LOCK_WATCHDOG_MS + 1000);
    // Still exactly one unlock — no watchdog misfire
    expect(mockPostUnlock).toHaveBeenCalledTimes(1);
  });

  it("remoteLock marks the tab locked by another tab; remoteUnlock clears it", () => {
    useTabSyncStore.getState().remoteLock("txn-1");
    expect(useTabSyncStore.getState().lockedByOtherTab).toBe(true);
    expect(useTabSyncStore.getState().remoteTxnId).toBe("txn-1");

    useTabSyncStore.getState().remoteUnlock();
    expect(useTabSyncStore.getState().lockedByOtherTab).toBe(false);
    expect(useTabSyncStore.getState().remoteTxnId).toBeNull();
  });

  it("remote lock expires after 30s without UNLOCK (crashed-holder safety)", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    useTabSyncStore.getState().remoteLock("txn-stale");
    expect(useTabSyncStore.getState().lockedByOtherTab).toBe(true);

    await vi.advanceTimersByTimeAsync(REMOTE_LOCK_EXPIRY_MS);

    expect(useTabSyncStore.getState().lockedByOtherTab).toBe(false);
    expect(useTabSyncStore.getState().remoteTxnId).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("remote lock expired")
    );

    warn.mockRestore();
  });

  it("a fresh remoteLock resets the expiry timer", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    useTabSyncStore.getState().remoteLock("txn-1");
    await vi.advanceTimersByTimeAsync(REMOTE_LOCK_EXPIRY_MS - 1);
    // Re-lock just before expiry — timer restarts
    useTabSyncStore.getState().remoteLock("txn-2");
    await vi.advanceTimersByTimeAsync(REMOTE_LOCK_EXPIRY_MS - 1);
    expect(useTabSyncStore.getState().lockedByOtherTab).toBe(true);

    await vi.advanceTimersByTimeAsync(2);
    expect(useTabSyncStore.getState().lockedByOtherTab).toBe(false);

    vi.restoreAllMocks();
  });
});
