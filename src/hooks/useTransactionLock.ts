import { useTabSyncStore } from "@/stores/tabsync";

export function useTransactionLock() {
  const withLock = useTabSyncStore((s) => s.withLock);
  const lockOwner = useTabSyncStore((s) => s.lockOwner);
  const holdingLock = lockOwner === "me";

  return {
    withLock,
    holdingLock,
  };
}

export function useActionDisabled() {
  return useTabSyncStore((s) => s.lockedByOtherTab);
}
