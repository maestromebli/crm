"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { normalizeRole } from "../../../lib/authz/roles";
import { useAssistantPageEntitySnapshot } from "../context/AssistantPageEntityContext";
import { buildContextHint, resolvePathnameContext } from "../utils/resolvePageContext";
import { resolveAssistantContext } from "../utils/resolveAssistantContext";
import { mergePageEntityIntoResolved } from "../utils/mergePageEntityIntoResolved";
import { buildQuickActions } from "../utils/quickActions";
import type { ContextHint } from "../types";
import { assistantConfig } from "../config/assistantConfig";
import type {
  AssistantQuickAction,
  AssistantResolvedContext,
  AssistantSessionSlice,
  ResolvedPageContext,
} from "../types";

const GUEST_HINT: ContextHint = {
  title: "Помічник",
  summary: "Увійдіть у систему для контекстних підказок.",
  suggestedNextStep: "",
  hasSuggestion: false,
  tone: "neutral",
};

export function useAssistantContext(): {
  pathname: string;
  page: ResolvedPageContext;
  sessionSlice: AssistantSessionSlice | null;
  resolved: AssistantResolvedContext | null;
  hidden: boolean;
  hint: ContextHint;
  quickActions: AssistantQuickAction[];
} {
  const pathname = usePathname() || "/";
  const pageEntity = useAssistantPageEntitySnapshot();
  const { data: session, status } = useSession();

  const page = useMemo(() => resolvePathnameContext(pathname), [pathname]);

  const sessionSlice = useMemo((): AssistantSessionSlice | null => {
    if (status !== "authenticated" || !session?.user) return null;
    const r = session.user.role ?? "USER";
    return {
      role: normalizeRole(r),
      userName: session.user.name ?? null,
      email: session.user.email ?? null,
    };
  }, [session, status]);

  const resolved = useMemo((): AssistantResolvedContext | null => {
    if (!sessionSlice) return null;
    const base = resolveAssistantContext({
      pathname,
      page,
      effectiveRole: sessionSlice.role,
      rawRole: session?.user?.role ?? "USER",
    });
    return mergePageEntityIntoResolved(base, pageEntity);
  }, [pathname, page, pageEntity, session?.user?.role, sessionSlice]);

  const hidden = useMemo(() => {
    if (!assistantConfig.enabled) return true;
    return assistantConfig.disabledPathPrefixes.some((p) =>
      pathname.startsWith(p),
    );
  }, [pathname]);

  const hint = useMemo((): ContextHint => {
    if (!sessionSlice) return GUEST_HINT;
    return buildContextHint(sessionSlice.role, page);
  }, [sessionSlice, page]);

  const quickActions = useMemo(() => {
    if (!sessionSlice) return [];
    return buildQuickActions(page, sessionSlice.role);
  }, [page, sessionSlice]);

  return {
    pathname,
    page,
    sessionSlice,
    resolved,
    hidden,
    hint,
    quickActions,
  };
}
