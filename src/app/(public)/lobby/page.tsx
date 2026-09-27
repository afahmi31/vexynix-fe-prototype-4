"use client";

import { Suspense } from "react";
import MemberLobbyPage, { MemberLobbySkeleton } from "@/components/game/member/MemberLobbyPage";

export default function LobbyPage() {
  return (
    <Suspense fallback={<MemberLobbySkeleton />}>
      <MemberLobbyPage />
    </Suspense>
  );
}
