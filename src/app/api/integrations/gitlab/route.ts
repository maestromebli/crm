import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { testGitLabConnection } from "../../../../lib/integrations/gitlab";

/** Перевірка підключення до GitLab (читає GITLAB_* з оточення сервера). */
export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const result = await testGitLabConnection();
  if (result.ok === false) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      httpStatus: result.status,
    });
  }

  return NextResponse.json({
    ok: true,
    baseUrl: result.baseUrl,
    gitlabVersion: result.gitlabVersion,
    user: result.user,
  });
}
