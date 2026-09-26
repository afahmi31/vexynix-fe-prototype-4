"use client";

import { Suspense } from "react";
import P4LobbyPage, { P4LobbySkeleton } from "@/components/game/p4/P4LobbyPage";

export default function LobbyPage() {
  return (
    <Suspense fallback={<P4LobbySkeleton />}>
      <P4LobbyPage />
    </Suspense>
  );
}
