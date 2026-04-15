import { NextResponse } from "next/server";
import { runDiiaSignatureWatchdog } from "../../../../../../lib/diia/signature-watchdog";

function verifySecret(req: Request): NextResponse | null {
  const configured =
    process.env.DIIA_WATCHDOG_SECRET?.trim() ??
    process.env.DIIA_WEBHOOK_SECRET?.trim() ??
    "";
  if (!configured) return null;
  const incoming = req.headers.get("x-diia-watchdog-secret")?.trim() ?? "";
  if (incoming !== configured) {
    return NextResponse.json({ error: "Заборонено" }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const forbidden = verifySecret(req);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const result = await runDiiaSignatureWatchdog({
    thresholdHours: Number(url.searchParams.get("thresholdHours") ?? 48),
    cooldownHours: Number(url.searchParams.get("cooldownHours") ?? 24),
    limit: Number(url.searchParams.get("limit") ?? 100),
    dryRun: (url.searchParams.get("dryRun") ?? "false").toLowerCase() === "true",
  });
  return NextResponse.json(result);
}
