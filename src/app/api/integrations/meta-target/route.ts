import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { testMetaTargetConnection } from "../../../../lib/integrations/meta-target";

/**
 * Мини-проверка подключения к Meta Marketing API.
 * Используется на странице настроек интеграции.
 */
export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const result = await testMetaTargetConnection();
  if (result.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        httpStatus: result.status,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Meta Ads OK · ${result.accountName} (${result.accountId}) · ${result.apiVersion}`,
    accountId: result.accountId,
    accountName: result.accountName,
    apiVersion: result.apiVersion,
  });
}
