import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { testInstagramConnection } from "../../../../lib/integrations/messaging";

/**
 * Мини-тест Instagram Graph API для текущего пользователя.
 */
export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const result = await testInstagramConnection(user.id);
  if ("error" in result) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      httpStatus: result.status,
    });
  }

  return NextResponse.json({
    ok: true,
    message: `Instagram OK · ${result.pageName} (${result.pageId})${result.instagramUsername ? ` · @${result.instagramUsername}` : ""}`,
    pageId: result.pageId,
    pageName: result.pageName,
    instagramBusinessAccountId: result.instagramBusinessAccountId,
    instagramUsername: result.instagramUsername,
  });
}
