import { NextResponse } from "next/server";
import { runDiiaSignatureWatchdog } from "../../../../../lib/diia/signature-watchdog";

function authorized(req: Request): boolean {
  const token = process.env.INTERNAL_CRON_SECRET?.trim();
  if (!token) return false;
  const incoming = req.headers.get("x-internal-cron-secret")?.trim() ?? "";
  return incoming === token;
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const result = await runDiiaSignatureWatchdog({
    thresholdHours: Number(url.searchParams.get("thresholdHours") ?? 48),
    cooldownHours: Number(url.searchParams.get("cooldownHours") ?? 24),
    limit: Number(url.searchParams.get("limit") ?? 100),
    dryRun: (url.searchParams.get("dryRun") ?? "false").toLowerCase() === "true",
  });
  return NextResponse.json(result);
}
