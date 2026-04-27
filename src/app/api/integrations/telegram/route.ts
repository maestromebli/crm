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

  const hasBotToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  return NextResponse.json({
    ok: hasBotToken,
    message: hasBotToken
      ? "Telegram integration configured."
      : "TELEGRAM_BOT_TOKEN is not configured.",
  });
}
