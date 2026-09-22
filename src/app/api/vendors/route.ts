import { NextResponse } from "next/server";
import { MOCK_VENDORS } from "@/mocks/prototype-3";

export function GET() {
  return NextResponse.json({ vendors: MOCK_VENDORS });
}
