import { useState, useCallback } from "react";
import { gamesApi } from "@/lib/api/games";
import { useSessionStore } from "@/stores/session";
import { useTransactionLock } from "@/hooks/useTransactionLock";
import { isApiError } from "@/lib/api/client";
import { isSessionExpiredError } from "@/lib/auth-redirect";

export function useLaunchGame() {
  const [launching, setLaunching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currency = useSessionStore((s) => s.currency);
  const { withLock } = useTransactionLock();

  const launch = useCallback(
    async (gameId: string, opts?: { demo?: boolean }) => {
      const demo = opts?.demo === true;
      setLaunching(gameId);
      setError(null);

      try {
        const req = {
          // No language: each vendor adapter picks the code its own API accepts for our
          // Indonesian players (PG SOFT -> id-ID). Hardcoding "en" here forced every
          // provider's game client into English.
          game_id: gameId,
          country: "ID",
          currency,
          demo,
        };
        // Free play moves no money, so it must NOT take the cross-tab transaction lock —
        // holding it would block a real deposit in another tab for the sake of a demo.
        // Real launches keep the lock, held only until launch_url returns.
        const result = demo
          ? await gamesApi.launch(req)
          : await withLock(() => gamesApi.launch(req));

        // Open in new tab — vendors require top-level browsing context
        window.open(result.launch_url, "_blank", "noopener");
      } catch (err) {
        // The public layout handles an expired session in place by opening the
        // login modal. Do not redirect from this hook as well: that creates a
        // visible blank /login shim before the modal can open.
        if (isSessionExpiredError(err)) {
          return;
        }
        if (isApiError(err, 403)) {
          setError("Game sedang tidak tersedia.");
        } else if (isApiError(err, 404)) {
          // On a demo launch a 404 means the provider or the game has no free-play mode —
          // the catalog flag is advisory and the route is the authority.
          setError(
            demo ? "Mode coba gratis tidak tersedia untuk game ini." : "Game tidak ditemukan."
          );
        } else if (isApiError(err, 502)) {
          setError("Provider game sedang bermasalah. Coba lagi sebentar.");
        } else if (isApiError(err, 401)) {
          // Only step-up 401s reach here — a dead session left above.
          setError("Verifikasi dibatalkan. Coba lagi.");
        } else {
          setError("Game gagal dibuka.");
        }
      } finally {
        setLaunching(null);
      }
    },
    [currency, withLock]
  );

  const launchDemo = useCallback((gameId: string) => launch(gameId, { demo: true }), [launch]);

  return {
    launch,
    launchDemo,
    launching,
    error,
    clearError: () => setError(null),
  };
}
