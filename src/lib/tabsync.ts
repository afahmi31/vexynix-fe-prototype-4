/**
 * BroadcastChannel-based tab-sync messages (P5.1) — per spec:
 * Channel name: `broadcast-channel('balance-sync')`; messages `{type:'LOCK'|'UNLOCK'|'BALANCE_UPDATE', …}`.
 * Guarded against environments without BroadcastChannel (SSR/jsdom) → noop + console.warn once.
 */

type TabSyncMessage =
  | { type: "LOCK"; txnId: string }
  | { type: "UNLOCK" }
  | { type: "BALANCE_UPDATE" };

export type { TabSyncMessage };

const CHANNEL_NAME = "balance-sync";
let channel: BroadcastChannel | null = null;
let warned = false;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") {
    // Server-side rendering: no channels needed, all state is local
    if (!warned) { console.warn("[tabsync] server-rendered context — multi-tab sync disabled"); warned = true; }
    return null;
  }
  if (typeof BroadcastChannel === "undefined") {
    if (!warned) { console.warn("[tabsync] BroadcastChannel unavailable — multi-tab sync disabled"); warned = true; }
    return null;
  }
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function postLock(txnId: string): void {
  const ch = getChannel();
  ch?.postMessage({ type: "LOCK", txnId });
}

export function postUnlock(): void {
  getChannel()?.postMessage({ type: "UNLOCK" });
}

export function postBalanceUpdate(): void {
  getChannel()?.postMessage({ type: "BALANCE_UPDATE" });
}

export function subscribe(handler: (msg: TabSyncMessage) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {}; // No-op subscriber
  const listener = (ev: MessageEvent<TabSyncMessage>) => handler(ev.data);
  ch.addEventListener("message", listener);
  return () => {
    ch.removeEventListener("message", listener);
  };
}

/** Reset channel cache (for tests only). */
export function __resetForTests() {
  if (channel) channel.close();
  channel = null;
  warned = false;
}
