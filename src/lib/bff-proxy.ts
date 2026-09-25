import { NextRequest, NextResponse } from "next/server";

const RESPONSE_HEADERS = ["cache-control", "content-type", "www-authenticate"];

export function isExternalBffMode(): boolean {
  return process.env.NEXT_PUBLIC_PROTOTYPE_MODE === "external";
}

function getBffOrigin(): string | null {
  const origin = process.env.NEXT_PUBLIC_BFF_ORIGIN?.trim();
  return origin ? origin.replace(/\/+$/, "") : null;
}

export async function proxyBff(
  request: NextRequest,
  path: string,
  init: RequestInit = {}
): Promise<NextResponse> {
  const origin = getBffOrigin();
  if (!origin) {
    return NextResponse.json(
      { message: "External BFF origin is not configured." },
      { status: 500 }
    );
  }

  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  try {
    const response = await fetch(`${origin}${path}${request.nextUrl.search}`, {
      ...init,
      cache: "no-store",
      headers,
    });
    const responseHeaders = new Headers();

    for (const header of RESPONSE_HEADERS) {
      const value = response.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ message: "BFF unavailable." }, { status: 502 });
  }
}
