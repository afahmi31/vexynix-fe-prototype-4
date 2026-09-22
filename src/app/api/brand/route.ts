import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    found: true,
    label: "VEXYNIX",
    logo_url: "",
    theme: {},
  });
}
