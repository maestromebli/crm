import type { SessionUser } from "../../../lib/authz/api-guard";
import { resolveAccessContext } from "../../../lib/authz/data-scope";
import { prisma } from "../../../lib/prisma";
import { getLeadById } from "../../leads/queries";
import { getDealWorkspacePayload } from "../../deal-workspace/queries";
import {
  buildLeadAiHints,
  computeLeadReadiness,
  computeLeadRisks,
  getLeadDominantNextStep,
  mapLeadDetailRowToCoreInput,
  readinessBlockerMessages,
} from "../../../lib/crm-core";
import { deriveAiSummary, deriveNextBestAction } from "../../deal-workspace/insights";
import { openAiChatJson } from "../core/openai-client";
import type {
  AiOperationId,
  AiOperationFailure,
  AiOperationResponse,
  AiOperationSuccess,
  FollowUpTone,
} from "../core/types";
import { serializeDealForAi } from "../context/serialize-deal-for-ai";
import { serializeLeadForAi } from "../context/serialize-lead-for-ai";
import {
  promptDashboardBrief,
  promptDealReadiness,
  promptDealSummary,
  promptLeadFollowUp,
  promptLeadNextStep,
  promptLeadRiskExplain,
  promptLeadSummary,
  promptProposalIntro,
  systemJsonAssistant,
} from "../prompts/operation-prompts";

const CUID = /^[a-z0-9]{20,40}$/i;

function isConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strArr(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

function fail(error: string, status: number): AiOperationFailure {
  return { ok: false, error, status };
}

export async function runAiOperation(params: {
  user: SessionUser;
  operation: AiOperationId;
  leadId?: string;
  dealId?: string;
  dashboardContext?: string;
  tone?: FollowUpTone;
}): Promise<AiOperationResponse> {
  const { user, operation } = params;
  const tone: FollowUpTone = params.tone ?? "neutral";

  const ctx = await resolveAccessContext(prisma, user);

  const runLead = async (): Promise<
    | { lead: NonNullable<Awaited<ReturnType<typeof getLeadById>>> }
    | AiOperationFailure
  > => {
    const leadId = params.leadId?.trim() ?? "";
    if (!leadId || !CUID.test(leadId)) {
      return fail("Некоректний leadId", 400);
    }
    const lead = await getLeadById(leadId, ctx);
    if (!lead) {
      return fail("Лід не знайдено", 404);
    }
    return { lead };
  };

  const runDeal = async (): Promise<
    | { data: NonNullable<Awaited<ReturnType<typeof getDealWorkspacePayload>>> }
    | AiOperationFailure
  > => {
    const dealId = params.dealId?.trim() ?? "";
    if (!dealId || !CUID.test(dealId)) {
      return fail("Некоректний dealId", 400);
    }
    const data = await getDealWorkspacePayload(dealId, ctx, {
      permissionKeys: user.permissionKeys,
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    });
    if (!data) {
      return fail("Угоду не знайдено", 404);
    }
    return { data };
  };

  switch (operation) {
    case "lead_summary": {
      const lr = await runLead();
      if (!("lead" in lr)) return lr;
      const { lead } = lr;
      const contextJson = serializeLeadForAi(lead);
      const core = mapLeadDetailRowToCoreInput(lead);
      const risks = computeLeadRisks(core);

      if (!isConfigured()) {
        const ok: AiOperationSuccess = {
          ok: true,
          operation,
          configured: false,
          result: {
            shortSummary: risks.items[0]?.messageUa ?? "Контекст обмежений — додайте AI_API_KEY для розгорнутого підсумку.",
            whatMattersNow: "Перевірте наступний контакт і актуальність КП/смети.",
            blockers: readinessBlockerFallback(core),
            nextSteps: [
              getLeadDominantNextStep(core).labelUa,
            ],
          },
        };
        return ok;
      }

      const ai = await openAiChatJson<Record<string, unknown>>({
        system: systemJsonAssistant(),
        user: promptLeadSummary(contextJson, user),
        maxTokens: 900,
      });
      if (ai.ok === false) {
        return fail(ai.error, ai.httpStatus ?? 502);
      }
      const d = ai.data;
      const out: AiOperationSuccess = {
        ok: true,
        operation,
        configured: true,
        result: {
          shortSummary: str(d.shortSummary) || "Без короткого підсумку.",
          whatMattersNow: str(d.whatMattersNow) || "Уточніть пріоритет з клієнтом.",
          blockers: strArr(d.blockers),
          nextSteps: strArr(d.nextSteps),
        },
      };
      return out;
    }

    case "lead_next_step": {
      const lr = await runLead();
      if (!("lead" in lr)) return lr;
      const { lead } = lr;
      const contextJson = serializeLeadForAi(lead);
      const core = mapLeadDetailRowToCoreInput(lead);
      const cta = getLeadDominantNextStep(core);

      if (!isConfigured()) {
        const ok: AiOperationSuccess = {
          ok: true,
          operation,
          configured: false,
          result: {
            recommendedAction: cta.labelUa,
            rationale: cta.reasonUa ?? "Визначено правилами стадії Lead Hub.",
            checklist: buildLeadAiHints(core).slice(0, 4).map((h) => h.textUa),
          },
        };
        return ok;
      }

      const ai = await openAiChatJson<Record<string, unknown>>({
        system: systemJsonAssistant(),
        user: promptLeadNextStep(contextJson, user),
        maxTokens: 800,
      });
      if (ai.ok === false) {
        return fail(ai.error, ai.httpStatus ?? 502);
      }
      const d = ai.data;
      const out: AiOperationSuccess = {
        ok: true,
        operation,
        configured: true,
        result: {
          recommendedAction: str(d.recommendedAction) || cta.labelUa,
          rationale: str(d.rationale) || "",
          checklist: strArr(d.checklist, 8),
        },
      };
      return out;
    }

    case "lead_follow_up": {
      const lr = await runLead();
      if (!("lead" in lr)) return lr;
      const { lead } = lr;
      const contextJson = serializeLeadForAi(lead);
      const core = mapLeadDetailRowToCoreInput(lead);

      if (!isConfigured()) {
        const ok: AiOperationSuccess = {
          ok: true,
          operation,
          configured: false,
          result: {
            shortVersion: `Доброго дня! Уточнюємо щодо пропозиції по «${lead.title}» — чи встигли ознайомитись? Готові відповісти на запитання.`,
            detailedVersion:
              "Доброго дня! Пишу щодо комерційної пропозиції: якщо потрібні корективи по складу, термінах або бюджету — підкажіть, щоб ми швидко оновили розрахунок. Також можу запропонувати короткий дзвінок на зручний час.",
            ctaSuggestion: "Зручно отримати коротку відповідь сьогодні до …?",
            tone,
          },
        };
        return ok;
      }

      const ai = await openAiChatJson<Record<string, unknown>>({
        system: systemJsonAssistant(),
        user: promptLeadFollowUp(contextJson, user, tone),
        maxTokens: 1000,
      });
      if (ai.ok === false) {
        return fail(ai.error, ai.httpStatus ?? 502);
      }
      const d = ai.data;
      const out: AiOperationSuccess = {
        ok: true,
        operation,
        configured: true,
        result: {
          shortVersion: str(d.shortVersion) || "Короткий текст недоступний.",
          detailedVersion: str(d.detailedVersion) || "",
          ctaSuggestion: str(d.ctaSuggestion) || "Підтвердіть зручний час для відповіді.",
          tone,
        },
      };
      return out;
    }

    case "lead_risk_explain": {
      const lr = await runLead();
      if (!("lead" in lr)) return lr;
      const { lead } = lr;
      const contextJson = serializeLeadForAi(lead);
      const core = mapLeadDetailRowToCoreInput(lead);
      const risks = computeLeadRisks(core);
      const top = risks.items[0];

      if (!isConfigured()) {
        const level =
          top?.severity === "high"
            ? "high"
            : top?.severity === "medium"
              ? "medium"
              : "low";
        const ok: AiOperationSuccess = {
          ok: true,
          operation,
          configured: false,
          result: {
            riskLevel: level,
            explanation:
              top?.messageUa ??
              "Системних ризиків за евристиками не виявлено — додайте AI_API_KEY для глибшого пояснення.",
            whatToDo: buildLeadAiHints(core).slice(0, 4).map((h) => h.textUa),
          },
        };
        return ok;
      }

      const ai = await openAiChatJson<Record<string, unknown>>({
        system: systemJsonAssistant(),
        user: promptLeadRiskExplain(contextJson, user),
        maxTokens: 900,
      });
      if (ai.ok === false) {
        return fail(ai.error, ai.httpStatus ?? 502);
      }
      const d = ai.data;
      const rl = str(d.riskLevel).toLowerCase();
      const riskLevel =
        rl === "high" || rl === "medium" || rl === "low" ? rl : "medium";
      const out: AiOperationSuccess = {
        ok: true,
        operation,
        configured: true,
        result: {
          riskLevel,
          explanation: str(d.explanation) || "",
          whatToDo: strArr(d.whatToDo, 10),
        },
      };
      return out;
    }

    case "proposal_intro": {
      const lr = await runLead();
      if (!("lead" in lr)) return lr;
      const { lead } = lr;
      const contextJson = serializeLeadForAi(lead);

      if (!isConfigured()) {
        const ok: AiOperationSuccess = {
          ok: true,
          operation,
          configured: false,
          result: {
            introParagraph:
              "Дякуємо за звернення до ENVER. Нижче — комерційна пропозиція з урахуванням обговорених параметрів об’єкта та побажань до складу.",
            bullets: [
              "Умови та склад фіксуються у версії КП та смети.",
              "За потреби підготуємо корекції після вашого фідбеку.",
            ],
            readinessNote:
              "Для детального тексту увімкніть AI_API_KEY у середовищі сервера.",
          },
        };
        return ok;
      }

      const ai = await openAiChatJson<Record<string, unknown>>({
        system: systemJsonAssistant(),
        user: promptProposalIntro(contextJson, user),
        maxTokens: 900,
      });
      if (ai.ok === false) {
        return fail(ai.error, ai.httpStatus ?? 502);
      }
      const d = ai.data;
      const out: AiOperationSuccess = {
        ok: true,
        operation,
        configured: true,
        result: {
          introParagraph: str(d.introParagraph) || "",
          bullets: strArr(d.bullets, 8),
          readinessNote: str(d.readinessNote) || "",
        },
      };
      return out;
    }

    case "deal_summary": {
      const dr = await runDeal();
      if (!("data" in dr)) return dr;
      const { data } = dr;
      const contextJson = serializeDealForAi(data, user);

      if (!isConfigured()) {
        const ok: AiOperationSuccess = {
          ok: true,
          operation,
          configured: false,
          result: {
            headline: `${data.deal.title} · ${data.stage.name}`,
            situation: deriveAiSummary(data),
            blockers: data.readiness.filter((r) => !r.done).map((r) => r.label),
            suggestedMoves: [deriveNextBestAction(data)],
          },
        };
        return ok;
      }

      const ai = await openAiChatJson<Record<string, unknown>>({
        system: systemJsonAssistant(),
        user: promptDealSummary(contextJson, user),
        maxTokens: 1000,
      });
      if (ai.ok === false) {
        return fail(ai.error, ai.httpStatus ?? 502);
      }
      const d = ai.data;
      const out: AiOperationSuccess = {
        ok: true,
        operation,
        configured: true,
        result: {
          headline: str(d.headline) || data.deal.title,
          situation: str(d.situation) || deriveAiSummary(data),
          blockers: strArr(d.blockers),
          suggestedMoves: strArr(d.suggestedMoves),
        },
      };
      return out;
    }

    case "deal_readiness": {
      const dr = await runDeal();
      if (!("data" in dr)) return dr;
      const { data } = dr;
      const contextJson = serializeDealForAi(data, user);
      const blockers = data.readiness.filter((r) => !r.done);

      if (!isConfigured()) {
        const ok: AiOperationSuccess = {
          ok: true,
          operation,
          configured: false,
          result: {
            ready: data.readinessAllMet,
            summary: data.readinessAllMet
              ? "Усі перевірки готовності виконані."
              : `Не виконано: ${blockers.map((b) => b.label).join(", ") || "—"}.`,
            blockers: blockers.map((b) => b.blockerMessage ?? b.label),
            recommendedActions: [deriveNextBestAction(data)],
          },
        };
        return ok;
      }

      const ai = await openAiChatJson<Record<string, unknown>>({
        system: systemJsonAssistant(),
        user: promptDealReadiness(contextJson, user),
        maxTokens: 1000,
      });
      if (ai.ok === false) {
        return fail(ai.error, ai.httpStatus ?? 502);
      }
      const d = ai.data;
      const ready = d.ready === true;
      const out: AiOperationSuccess = {
        ok: true,
        operation,
        configured: true,
        result: {
          ready,
          summary: str(d.summary) || "",
          blockers: strArr(d.blockers),
          recommendedActions: strArr(d.recommendedActions),
        },
      };
      return out;
    }

    case "dashboard_brief": {
      const raw = params.dashboardContext?.trim() ?? "";
      if (!raw) {
        return fail("Відсутній dashboardContext", 400);
      }

      if (!isConfigured()) {
        let parsed: { kpis?: { overdueTasks?: number } } = {};
        try {
          parsed = JSON.parse(raw) as typeof parsed;
        } catch {
          parsed = {};
        }
        const overdue = parsed.kpis?.overdueTasks ?? 0;
        const ok: AiOperationSuccess = {
          ok: true,
          operation,
          configured: false,
          result: {
            priorities: [
              "Переглянути список «Увага» на дашборді.",
              "Закрити прострочені задачі, якщо вони є.",
            ],
            urgentItems:
              overdue > 0
                ? [`Прострочені задачі: орієнтовно ${overdue}.`]
                : ["Критичних прострочень за KPI не виявлено."],
            risks: ["Детальний AI-огляд потребує AI_API_KEY."],
            managerActions: [
              "Синхронізувати команду щодо найближчих дедлайнів.",
            ],
          },
        };
        return ok;
      }

      const ai = await openAiChatJson<Record<string, unknown>>({
        system: systemJsonAssistant(),
        user: promptDashboardBrief(raw, user),
        maxTokens: 1100,
      });
      if (ai.ok === false) {
        return fail(ai.error, ai.httpStatus ?? 502);
      }
      const d = ai.data;
      const out: AiOperationSuccess = {
        ok: true,
        operation,
        configured: true,
        result: {
          priorities: strArr(d.priorities, 8),
          urgentItems: strArr(d.urgentItems, 8),
          risks: strArr(d.risks, 8),
          managerActions: strArr(d.managerActions, 10),
        },
      };
      return out;
    }

    default:
      return fail(`Невідома операція: ${operation}`, 400);
  }
}

function readinessBlockerFallback(
  core: ReturnType<typeof mapLeadDetailRowToCoreInput>,
): string[] {
  const r = computeLeadReadiness(core);
  return readinessBlockerMessages(r.blockers).slice(0, 6);
}
