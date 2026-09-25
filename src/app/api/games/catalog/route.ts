import { NextResponse } from "next/server";
import { MOCK_CATALOG } from "@/mocks/p4";
import { isExternalBffMode, proxyBff } from "@/lib/bff-proxy";
import type { NextRequest } from "next/server";

export function GET(request: NextRequest): Promise<NextResponse> | NextResponse {
  if (isExternalBffMode()) return proxyBff(request, "/api/games/catalog");

  return NextResponse.json({ games: MOCK_CATALOG });
}
