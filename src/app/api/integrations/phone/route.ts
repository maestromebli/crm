import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { testPhoneConnection } from "../../../../lib/integrations/messaging";

/**
 * Мини-тест телефонного API провайдера для поточного користувача.
 */
export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const result = await testPhoneConnection(user.id);
  if ("error" in result) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      httpStatus: result.status,
    });
  }

  return NextResponse.json({
    ok: true,
    message: `Phone OK · ${result.provider} · ${result.apiUrl} · HTTP ${result.probeStatus}`,
    provider: result.provider,
    apiUrl: result.apiUrl,
    probeStatus: result.probeStatus,
  });
}
