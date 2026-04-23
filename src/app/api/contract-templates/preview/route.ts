import { NextRequest, NextResponse } from "next/server";
import { renderContractHtml } from "@/features/contracts/services/render-contract-html";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

export async function POST(req: NextRequest) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const body = (await req.json()) as {
    bodyHtml?: string;
    payloadJson?: Record<string, unknown>;
  };
  const html = String(body.bodyHtml ?? "");
  const payload = body.payloadJson ?? {};
  if (!html) {
    return NextResponse.json({ error: "Поле bodyHtml є обов'язковим" }, { status: 400 });
  }
  return NextResponse.json(renderContractHtml(html, payload));
}
