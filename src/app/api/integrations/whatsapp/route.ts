import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { testWhatsappConnection } from "../../../../lib/integrations/messaging";

/**
 * Мини-тест WhatsApp Cloud API для текущего пользователя.
 */
export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const result = await testWhatsappConnection(user.id);
  if ("error" in result) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      httpStatus: result.status,
    });
  }

  return NextResponse.json({
    ok: true,
    message: `WhatsApp OK · ${result.displayPhoneNumber} · ${result.verifiedName}`,
    phoneNumberId: result.phoneNumberId,
    displayPhoneNumber: result.displayPhoneNumber,
    verifiedName: result.verifiedName,
  });
}
