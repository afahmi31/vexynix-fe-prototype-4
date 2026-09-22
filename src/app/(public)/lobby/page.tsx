"use client";

import { Suspense } from "react";
import P4LobbyPage from "@/components/game/p4/P4LobbyPage";

export default function LobbyPage() {
  return (
    <Suspense fallback={null}>
      <P4LobbyPage />
    </Suspense>
  );
}
