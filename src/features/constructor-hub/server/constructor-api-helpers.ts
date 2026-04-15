import { NextResponse } from "next/server";
import { getOrCreateRequestId, jsonError } from "@/lib/api/http";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { getConstructorWorkspaceOrThrow } from "./constructor-workspace.service";
import { canViewConstructorWorkspace } from "./constructor-rbac";
import type { SessionUser } from "@/lib/authz/api-guard";

type ConstructorSessionResult =
  | { ok: true; requestId: string; user: SessionUser }
  | { ok: false; requestId: string; errorResponse: NextResponse };

type WorkspaceScopeResult =
  | { ok: true; requestId: string; user: SessionUser; workspace: Awaited<ReturnType<typeof getConstructorWorkspaceOrThrow>> }
  | { ok: false; requestId: string; errorResponse: NextResponse };

export async function requireConstructorSession(request: Request): Promise<ConstructorSessionResult> {
  const requestId = getOrCreateRequestId(request);
  const user = await requireSessionUser();
  if (user instanceof NextResponse) {
    return { ok: false as const, requestId, errorResponse: user as NextResponse };
  }
  return { ok: true as const, requestId, user };
}

export async function requireWorkspaceViewScope(input: {
  request: Request;
  workspaceId: string;
}): Promise<WorkspaceScopeResult> {
  const session = await requireConstructorSession(input.request);
  if (session.ok === false) {
    return {
      ok: false,
      requestId: session.requestId,
      errorResponse: session.errorResponse,
    };
  }
  try {
    const workspace = await getConstructorWorkspaceOrThrow(input.workspaceId);
    if (!canViewConstructorWorkspace(session.user, workspace)) {
      return {
        ok: false as const,
        requestId: session.requestId,
        errorResponse: jsonError(session.requestId, "Доступ запрещен", 403),
      };
    }
    return { ok: true as const, requestId: session.requestId, user: session.user, workspace };
  } catch (e) {
    return {
      ok: false as const,
      requestId: session.requestId,
      errorResponse: jsonError(
        session.requestId,
        e instanceof Error ? e.message : "Workspace не найден",
        404,
      ),
    };
  }
}
