import { NextResponse } from "next/server";
import { runFollowUpWatchdog } from "@/lib/deals/follow-up-watchdog";

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
    return NextResponse.json({ error: "Заборонено" }, { status: 403 });
  }

  const url = new URL(req.url);
  const result = await runFollowUpWatchdog({
    limit: Number(url.searchParams.get("limit") ?? 200),
    dryRun: (url.searchParams.get("dryRun") ?? "false").toLowerCase() === "true",
  });
  return NextResponse.json(result);
}
