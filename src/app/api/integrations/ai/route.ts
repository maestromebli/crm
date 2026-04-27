import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const hasApiKey = Boolean(process.env.AI_API_KEY);
  return NextResponse.json({
    ok: hasApiKey,
    message: hasApiKey
      ? "AI integration configured."
      : "AI_API_KEY is not configured.",
  });
}
