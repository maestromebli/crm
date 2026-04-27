import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { testViberConnection } from "../../../../lib/integrations/messaging";

/**
 * Мини-тест Viber Public Account API для поточного користувача.
 */
export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const result = await testViberConnection(user.id);
  if ("error" in result) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      httpStatus: result.status,
    });
  }

  return NextResponse.json({
    ok: true,
    message: `Viber OK · ${result.accountName} · ${result.accountUri}`,
    accountName: result.accountName,
    accountUri: result.accountUri,
  });
}
