import { NextResponse } from "next/server";

import { checkDbConnection } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkDbConnection();

  if (result.ok) {
    return NextResponse.json({
      status: "ok",
      database: "connected",
      serverTime: result.serverTime,
    });
  }

  const status = result.configured ? 500 : 503;

  return NextResponse.json(
    {
      status: "error",
      database: "disconnected",
      configured: result.configured,
      error: result.error,
    },
    { status },
  );
}
