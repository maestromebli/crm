import type { EffectiveRole } from "../../../lib/authz/roles";
import type {
  AssistantContextKind,
  AssistantRecommendation,
  AssistantResolvedContext,
  AssistantRole,
  ResolvedPageContext,
} from "../types";
import { buildContextHint } from "./resolvePageContext";
import { buildQuickActions } from "./quickActions";

function mapToAssistantRole(
  effective: EffectiveRole,
  rawRole: string,
): AssistantRole {
  const raw = rawRole.toUpperCase();
  if (raw.includes("MEASUR") || raw.includes("ЗАМІР")) return "MEASURER";
  if (effective === "SUPER_ADMIN") return "ADMIN";
  if (effective === "DIRECTOR") return "DIRECTOR";
  if (effective === "HEAD_MANAGER") return "HEAD_MANAGER";
  if (effective === "TEAM_LEAD") return "TEAM_LEAD";
  if (effective === "SALES_MANAGER") return "SALES_MANAGER";
  if (raw.includes("TEAM") && raw.includes("LEAD")) return "TEAM_LEAD";
  if (raw.includes("ТІМЛІД") || raw.includes("ТИМЛІД")) return "TEAM_LEAD";
  return "UNKNOWN";
}

function inferContextKind(
  pathname: string,
  page: ResolvedPageContext,
): AssistantContextKind {
  const p = pathname.toLowerCase();
  if (p.includes("/estimate") || p.includes("/pricing")) return "calculation";
  if (p.includes("/proposals/") || p.includes("/proposal")) return "quote";
  if (p.includes("contract") && page.dealId) return "contract";
  if (page.kind === "lead_detail") return "lead";
  if (page.kind === "deal_detail" || page.kind === "deal_workspace")
    return "deal";
  if (page.kind === "calendar") return "calendar";
  if (page.kind === "dashboard" || pathname === "/") return "dashboard";
  return "unknown";
}

function hintToneToLevel(
  tone: "neutral" | "attention" | "risk",
): AssistantRecommendation["level"] {
  if (tone === "risk") return "warning";
  if (tone === "attention") return "warning";
  return "info";
}

/**
 * Безпечний резолв контексту для помічника без обов’язкових даних з API.
 * Поля сутностей (title, статуси, задачі) — заповнюються, коли з’явиться інтеграція.
 */
export function resolveAssistantContext(input: {
  pathname: string;
  page: ResolvedPageContext;
  effectiveRole: EffectiveRole;
  rawRole: string;
}): AssistantResolvedContext {
  const { pathname, page, effectiveRole, rawRole } = input;
  const role = mapToAssistantRole(effectiveRole, rawRole);
  const contextKind = inferContextKind(pathname, page);
  const hint = buildContextHint(effectiveRole, page);

  const recommendations: AssistantRecommendation[] = [
    {
      id: "hint-primary",
      title: hint.title,
      description: hint.summary,
      level: hintToneToLevel(hint.tone),
    },
  ];
  if (hint.hasSuggestion) {
    recommendations.push({
      id: "hint-next",
      title: "Наступний крок",
      description: hint.suggestedNextStep,
      level: "info",
    });
  }

  const qa = buildQuickActions(page, effectiveRole);

  return {
    role,
    contextKind,
    route: pathname,
    entityId: page.leadId ?? page.dealId,
    entityTitle: null,
    status: null,
    missingFields: [],
    overdueTasks: 0,
    staleSinceHours: null,
    paymentStatus: null,
    quoteStatus: null,
    recommendationCount: recommendations.length,
    recommendations,
    quickActions: qa,
    nextBestAction: hint.suggestedNextStep,
  };
}
