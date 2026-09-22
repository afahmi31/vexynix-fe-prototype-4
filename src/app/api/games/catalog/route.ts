import { NextResponse } from "next/server";
import { MOCK_CATALOG } from "@/mocks/prototype-3";

export function GET() {
  return NextResponse.json({ games: MOCK_CATALOG });
}
