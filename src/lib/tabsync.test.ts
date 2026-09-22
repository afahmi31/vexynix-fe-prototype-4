import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("tabsync without BroadcastChannel", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Fresh module per test (module caches channel + warned flag)
    vi.resetModules();
    // Simulate SSR/jsdom/old browsers: BroadcastChannel absent
    vi.stubGlobal("BroadcastChannel", undefined);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleWarnSpy.mockRestore();
  });

  it("postLock/postUnlock/postBalanceUpdate are noops and warn", async () => {
    const ts = await import("./tabsync");

    expect(() => ts.postLock("t1")).not.toThrow();
    expect(() => ts.postUnlock()).not.toThrow();
    expect(() => ts.postBalanceUpdate()).not.toThrow();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("BroadcastChannel unavailable")
    );
  });

  it("subscribe returns a callable unsubscribe noop and never fires the handler", async () => {
    const ts = await import("./tabsync");
    const handler = vi.fn();
    const unsubscribe = ts.subscribe(handler);

    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("tabsync with BroadcastChannel", () => {
  const postedMessages: unknown[] = [];
  const instances: FakeBroadcastChannel[] = [];

  // Fake BroadcastChannel — same-context delivery only (no cross-context timing)
  class FakeBroadcastChannel {
    name: string;
    listeners: Array<(ev: MessageEvent) => void>;

    constructor(name: string) {
      this.name = name;
      this.listeners = [];
      instances.push(this);
    }

    postMessage(message: unknown): void {
      postedMessages.push(message);
      this.listeners.forEach((fn) => fn({ data: message } as MessageEvent));
    }

    addEventListener(event: string, fn: (ev: MessageEvent) => void): void {
      if (event === "message") this.listeners.push(fn);
    }

    removeEventListener(event: string, fn: (ev: MessageEvent) => void): void {
      if (event !== "message") return;
      const idx = this.listeners.indexOf(fn);
      if (idx >= 0) this.listeners.splice(idx, 1);
    }

    close(): void {
      this.listeners.length = 0;
    }
  }

  beforeEach(() => {
    vi.resetModules();
    postedMessages.length = 0;
    instances.length = 0;
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("postLock posts LOCK with txnId on the balance-sync channel", async () => {
    const ts = await import("./tabsync");
    ts.postLock("abc-123");
    expect(instances).toHaveLength(1);
    const channel = instances[0] as FakeBroadcastChannel;
    expect(channel.name).toBe("balance-sync");
    expect(postedMessages).toEqual([{ type: "LOCK", txnId: "abc-123" }]);
  });

  it("postUnlock posts UNLOCK", async () => {
    const ts = await import("./tabsync");
    ts.postUnlock();
    expect(postedMessages).toEqual([{ type: "UNLOCK" }]);
  });

  it("postBalanceUpdate posts BALANCE_UPDATE", async () => {
    const ts = await import("./tabsync");
    ts.postBalanceUpdate();
    expect(postedMessages).toEqual([{ type: "BALANCE_UPDATE" }]);
  });

  it("subscribe receives messages posted to the channel and unsubscribe stops them", async () => {
    const ts = await import("./tabsync");
    const msgs: unknown[] = [];
    const unsubscribe = ts.subscribe((msg) => msgs.push(msg));

    // The module lazily created its channel in subscribe()
    expect(instances).toHaveLength(1);
    const channel = instances[0] as FakeBroadcastChannel;

    channel.postMessage({ type: "LOCK", txnId: "x" });
    channel.postMessage({ type: "UNLOCK" });
    expect(msgs).toEqual([
      { type: "LOCK", txnId: "x" },
      { type: "UNLOCK" },
    ]);

    unsubscribe();
    channel.postMessage({ type: "BALANCE_UPDATE" });
    expect(msgs).toHaveLength(2);
  });
});
