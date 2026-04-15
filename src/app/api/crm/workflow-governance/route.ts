import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { jsonContractError, jsonContractSuccess } from "@/lib/api/contract";
import { enforceAnyPolicy, getRequestContext } from "@/lib/platform";
import { getCanonicalWorkflowGovernance } from "@/lib/workflow";

export async function GET(req: Request) {
  const requestCtx = getRequestContext(req);
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = enforceAnyPolicy(user, [P.SETTINGS_VIEW, P.AUDIT_LOG_VIEW]);
  if (denied) {
    return jsonContractError(
      requestCtx,
      { code: "FORBIDDEN", message: "Недостатньо прав" },
      403,
    );
  }

  return jsonContractSuccess(requestCtx, {
    workflow: getCanonicalWorkflowGovernance(),
  });
}

