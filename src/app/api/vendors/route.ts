import { NextResponse } from "next/server";
import { MOCK_VENDORS } from "@/mocks/p4";

export function GET() {
  return NextResponse.json({ vendors: MOCK_VENDORS });
}
