import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { loadEventHealthSnapshot } from "@/lib/events/event-health";
import { getEventCatalogV1 } from "@/lib/events/event-catalog";
import { enforceAnyPolicy, getRequestContext } from "@/lib/platform";
import { jsonContractError, jsonContractSuccess } from "@/lib/api/contract";
import { ENVER_SLO } from "@/config/slo";
import { logError } from "@/lib/observability/logger";

export async function GET(req: Request) {
  const requestCtx = getRequestContext(req);
  if (!process.env.DATABASE_URL?.trim()) {
    return jsonContractError(
      requestCtx,
      { code: "DATABASE_UNAVAILABLE", message: "DATABASE_URL не задано" },
      503,
    );
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = enforceAnyPolicy(user, [P.AUDIT_LOG_VIEW, P.SETTINGS_VIEW]);
  if (denied) {
    return jsonContractError(
      requestCtx,
      { code: "FORBIDDEN", message: "Недостатньо прав" },
      403,
    );
  }

  try {
    const snapshot = await loadEventHealthSnapshot();
    return jsonContractSuccess(requestCtx, {
      ...snapshot,
      catalog: getEventCatalogV1(),
      slo: ENVER_SLO.events,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    logError({
      module: "api.crm.event-стан",
      message: "Не вдалося завантажити знімок стану подій",
      requestId: requestCtx.requestId,
      correlationId: requestCtx.correlationId,
      details: { cause: message },
    });
    return jsonContractError(
      requestCtx,
      { code: "EVENT_HEALTH_FAILED", message },
      500,
    );
  }
}
