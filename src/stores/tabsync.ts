import { create } from "zustand";
import { postLock, postUnlock } from "@/lib/tabsync";

export const LOCK_WATCHDOG_MS = 30_000;
export const REMOTE_LOCK_EXPIRY_MS = 30_000;

// Module-level state for timers
let localWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
let remoteExpiryTimer: ReturnType<typeof setTimeout> | null = null;
let currentLockToken: string | null = null;

type LockOwner = "me" | null;

interface TabSyncState {
  lockedByOtherTab: boolean;
  lockOwner: LockOwner;
  remoteTxnId: string | null;

  // Acquire a transaction lock (returns fn promise)
  withLock: <T>(fn: () => Promise<T>) => Promise<T>;

  // Remote lock/unlock helpers (called by UI listeners)
  remoteLock: (txnId: string | null) => void;
  remoteUnlock: () => void;

  // Reset state (for tests)
  _resetForTests: () => void;
}

function clearLocalWatchdog(): void {
  if (localWatchdogTimer) {
    clearTimeout(localWatchdogTimer);
    localWatchdogTimer = null;
  }
}

function clearRemoteExpiry(): void {
  if (remoteExpiryTimer) {
    clearTimeout(remoteExpiryTimer);
    remoteExpiryTimer = null;
  }
}

export const useTabSyncStore = create<TabSyncState>((set, get) => ({
  lockedByOtherTab: false,
  lockOwner: null,
  remoteTxnId: null,

  withLock: async <T>(fn: () => Promise<T>): Promise<T> => {
    const { lockOwner } = get();

    // Reentrancy: if already holding lock myself, run inline without re-posting LOCK
    if (lockOwner === "me") {
      return await fn();
    }

    // Generate txnId
    const generateTxnId = (): string => {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
      return `txn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    };
    const txnId = generateTxnId();

    // Take lock
    currentLockToken = txnId;
    postLock(txnId);
    set({ lockOwner: "me" });

    // Clear any prior remote expiry timer
    clearRemoteExpiry();

    // Start 30s watchdog that auto-unlocks (crash safety / hung-tab recovery)
    clearLocalWatchdog();
    localWatchdogTimer = setTimeout(() => {
      const currentState = get();
      if (currentState.lockOwner === "me" && currentLockToken === txnId) {
        currentLockToken = null;
        set({ lockOwner: null });
        postUnlock();
        console.warn(`[tabsync] lock watchdog fired — auto-unlocked after ${LOCK_WATCHDOG_MS}ms`);
      }
    }, LOCK_WATCHDOG_MS);

    try {
      const result = await fn();
      return result;
    } finally {
      clearLocalWatchdog();
      // Only release if I still own it and token matches (prevents double-release if watchdog already fired)
      if (get().lockOwner === "me" && currentLockToken === txnId) {
        currentLockToken = null;
        set({ lockOwner: null });
        postUnlock();
      }
      // else: watchdog already released the lock
    }
  },

  remoteLock: (txnId: string | null) => {
    clearRemoteExpiry();
    set({ lockedByOtherTab: true, remoteTxnId: txnId ?? null });
    // Start remote-lock expiry timer: if no UNLOCK within 30s, assume stale
    remoteExpiryTimer = setTimeout(() => {
      const state = get();
      if (state.lockedByOtherTab) {
        set({ lockedByOtherTab: false, remoteTxnId: null });
        console.warn(`[tabsync] remote lock expired after ${REMOTE_LOCK_EXPIRY_MS}ms without UNLOCK`);
      }
    }, REMOTE_LOCK_EXPIRY_MS);
  },

  remoteUnlock: () => {
    clearRemoteExpiry();
    set({ lockedByOtherTab: false, remoteTxnId: null });
  },

  _resetForTests: () => {
    clearLocalWatchdog();
    clearRemoteExpiry();
    currentLockToken = null;
    set({ lockedByOtherTab: false, lockOwner: null, remoteTxnId: null });
  },
}));
