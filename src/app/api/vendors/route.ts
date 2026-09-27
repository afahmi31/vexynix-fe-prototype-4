import { NextResponse } from "next/server";
import { MOCK_VENDORS } from "@/mocks/member";
import { isExternalBffMode, proxyBff } from "@/lib/bff-proxy";
import type { NextRequest } from "next/server";

export function GET(request: NextRequest): Promise<NextResponse> | NextResponse {
  if (isExternalBffMode()) return proxyBff(request, "/api/vendors");

  return NextResponse.json({ vendors: MOCK_VENDORS });
}
