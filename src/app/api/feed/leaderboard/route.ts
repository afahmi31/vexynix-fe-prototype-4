import { NextResponse } from "next/server";
import { isExternalBffMode, proxyBff } from "@/lib/bff-proxy";
import type { NextRequest } from "next/server";

export function GET(request: NextRequest): Promise<NextResponse> | NextResponse {
  if (isExternalBffMode()) return proxyBff(request, "/api/feed/leaderboard");

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    kind: "leaderboard",
    rows: [],
    tenant: 0,
    window: request.nextUrl.searchParams.get("window") ?? "7d",
  });
}
