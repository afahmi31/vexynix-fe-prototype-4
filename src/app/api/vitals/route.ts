/**
 * Route handler for web vitals and client error reporting.
 * Receives data from client (via sendBeacon) and logs to stdout.
 * Fire-and-forget pattern: no blocking response needed.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Distinguish between vitals and errors based on structure
    if (body.type === "vital" || body.name) {
      // Web vitals metric
      const vital = {
        type: "vital",
        metric: body.metric || body.name,
        value: body.value,
        unit: body.unit || "ms",
        rating: body.rating,
        timestamp: body.timestamp || new Date().toISOString(),
      };
      console.log("[OBSERVABILITY]", JSON.stringify(vital));
    } else if (body.message) {
      // Client error report
      const error = {
        type: "error",
        message: body.message,
        fileName: body.fileName,
        lineNumber: body.lineNumber,
        columnNumber: body.columnNumber,
        stack: body.stack,
        eventType: body.eventType,
        routePath: body.routePath,
        userId: body.userId,
        timestamp: body.timestamp || new Date().toISOString(),
      };
      console.error("[OBSERVABILITY]", JSON.stringify(error));
    } else {
      // Unknown payload structure
      console.warn("[OBSERVABILITY] Unknown payload:", JSON.stringify(body));
    }

    // Return 202 Accepted (fire-and-forget)
    return new NextResponse(null, { status: 202 });
  } catch (error) {
    console.error("[OBSERVABILITY] Error processing telemetry:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to process telemetry" }),
      { status: 500 }
    );
  }
}

// GET request for health check
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "/api/vitals" });
}
