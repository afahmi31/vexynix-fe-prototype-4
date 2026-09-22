import { Suspense } from "react";
import PlayersDirectory from "@/components/admin/players/PlayerDirectory";

/**
 * P7.3 — Players directory page.
 * Server wrapper around the interactive Client Component (Suspense required for useSearchParams).
 */
export default function PlayersPage() {
  return (
    <>
      <h1 className="page-header">Players</h1>
      <Suspense fallback={<div className="text-muted py-4">Loading...</div>}>
        <PlayersDirectory />
      </Suspense>
    </>
  );
}
