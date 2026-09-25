import { NextRequest, NextResponse } from "next/server";
import { MOCK_CATALOG } from "@/mocks/p4";
import { isExternalBffMode, proxyBff } from "@/lib/bff-proxy";

export async function POST(request: NextRequest) {
  if (isExternalBffMode()) {
    const headers = new Headers();
    const authorization = request.headers.get("authorization");
    const contentType = request.headers.get("content-type");
    if (authorization) headers.set("Authorization", authorization);
    if (contentType) headers.set("Content-Type", contentType);

    return proxyBff(request, "/api/games/launch", {
      method: "POST",
      body: await request.text(),
      headers,
    });
  }

  let body: { game_id?: string; demo?: boolean };
  try {
    body = (await request.json()) as { game_id?: string; demo?: boolean };
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const game = MOCK_CATALOG.find((item) => item.id === body.game_id);
  if (!game || game.status !== "active") {
    return NextResponse.json({ error: "Game tidak tersedia." }, { status: 404 });
  }
  if (body.demo === true && !game.demo_supported) {
    return NextResponse.json(
      { error: "Mode coba gratis tidak tersedia untuk game ini." },
      { status: 404 }
    );
  }

  const mode = body.demo === true ? "demo" : "real";
  return NextResponse.json({
    game_id: game.id,
    launch_url: "/mock-game/" + encodeURIComponent(game.id) + "?mode=" + mode,
    demo: body.demo === true,
  });
}
