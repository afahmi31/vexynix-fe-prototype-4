"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribe } from "@/lib/tabsync";
import { useTabSyncStore } from "@/stores/tabsync";

export default function LockBanner() {
  const lockedByOtherTab = useTabSyncStore((s) => s.lockedByOtherTab);
  const remoteLock = useTabSyncStore((s) => s.remoteLock);
  const remoteUnlock = useTabSyncStore((s) => s.remoteUnlock);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      switch (msg.type) {
        case "LOCK":
          remoteLock(msg.txnId);
          break;
        case "UNLOCK":
          remoteUnlock();
          queryClient.invalidateQueries({ queryKey: ["balance"] });
          break;
        case "BALANCE_UPDATE":
          queryClient.invalidateQueries({ queryKey: ["balance"] });
          break;
      }
    });

    return () => unsubscribe();
  }, [remoteLock, remoteUnlock, queryClient]);

  if (!lockedByOtherTab) return null;

  return (
    <div
      className="alert alert-warning d-flex align-items-center gap-2 shadow-sm fs-13px mb-0"
      role="alert"
      style={{ position: "fixed", top: "54px", left: "50%", transform: "translateX(-50%)", zIndex: 1030 }}
    >
      <i className="fa fa-lock" />
      <span>Transaksi sedang berlangsung di tab lain</span>
    </div>
  );
}
