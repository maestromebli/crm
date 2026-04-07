import { leadFirstTouchSlaMinutes } from "../leads/lead-sla";
import { getStageConfig } from "./lead-stage.config";
import type { LeadCoreInput } from "./lead-input.types";
import type { LeadAiHint } from "./lead-stage.types";

function hint(id: string, textUa: string, priority: number): LeadAiHint {
  return { id, textUa, priority };
}

/**
 * Структуровані підказки для AI / смарт-огляду (локальні правила, без LLM).
 */
export function buildLeadAiHints(lead: LeadCoreInput): LeadAiHint[] {
  const out: LeadAiHint[] = [];
  const cfg = getStageConfig(lead.stageKey);
  const prop = lead.commercial.latestProposal;
  const est = lead.commercial.latestEstimate;

  if (lead.slaFirstTouchBreached) {
    out.push(
      hint(
        "sla_new",
        `Клієнт без першого дотику понад ${leadFirstTouchSlaMinutes()} хв. — негайний дзвінок.`,
        10,
      ),
    );
  }

  if (!lead.commercial.activeEstimateId && lead.commercial.estimates.length > 0) {
    out.push(
      hint(
        "no_active_estimate",
        "Немає активної версії розрахунку — оберіть поточну смету.",
        8,
      ),
    );
  }

  if (lead.commercial.estimates.length === 0 && lead.stageKey === "CALCULATION") {
    out.push(
      hint(
        "calc_empty",
        "На етапі розрахунку немає жодної версії смети.",
        9,
      ),
    );
  }

  if (lead.stageKey === "QUOTE_SENT" && prop) {
    const statusUa: Record<string, string> = {
      SENT: "КП надіслано — уточніть: переглянув / питає / думає.",
      CLIENT_REVIEWING: "Клієнт переглядає КП — зафіксуйте наступний дотик.",
      REJECTED: "Відмова по КП — оновіть смету та умови перед новим раундом.",
    };
    const t = statusUa[prop.status];
    if (t) out.push(hint("quote_sent_pipeline", t, 8));
  }

  if (prop?.status === "APPROVED") {
    out.push(
      hint(
        "pre_conversion_kp",
        "Перед конверсією перевірте погоджене КП та суму в сметі.",
        7,
      ),
    );
  }

  if (
    prop &&
    (prop.status === "SENT" || prop.status === "CLIENT_REVIEWING") &&
    !lead.nextContactAt
  ) {
    let hoursSinceSent: number | null = null;
    if (prop.sentAt) {
      const sent = new Date(prop.sentAt);
      if (!Number.isNaN(sent.getTime())) {
        hoursSinceSent = (Date.now() - sent.getTime()) / 3_600_000;
      }
    }
    if (hoursSinceSent !== null && hoursSinceSent >= 48) {
      out.push(
        hint(
          "quote_48h_no_touch",
          "Клієнту не писали понад 48 год. після надсилання КП — надішліть короткий follow-up або заплануйте дзвінок.",
          9,
        ),
      );
    } else {
      out.push(
        hint(
          "followup_after_quote",
          "Після відправки КП варто запланувати дату наступного контакту.",
          6,
        ),
      );
    }
  }

  if (!lead.qualification.budgetRange?.trim() && lead.stageKey !== "NEW") {
    out.push(
      hint(
        "budget",
        "Бюджет не зафіксовано — уточніть діапазон для точнішого КП.",
        4,
      ),
    );
  }

  if (cfg.aiHintProfile.includes("qual_incomplete") && !lead.qualification.needsSummary?.trim()) {
    out.push(
      hint(
        "qual_summary",
        "Додайте короткий опис запиту клієнта в кваліфікації.",
        5,
      ),
    );
  }

  if (
    est &&
    prop?.status === "DRAFT" &&
    prop.estimateId !== lead.commercial.activeEstimateId
  ) {
    out.push(
      hint(
        "proposal_estimate_mismatch",
        "Чернетка КП може бути не на базі активної смети — перевірте прив’язку.",
        8,
      ),
    );
  }

  out.sort((a, b) => b.priority - a.priority);
  return out;
}

export function primaryLeadAiHint(lead: LeadCoreInput): string | null {
  const h = buildLeadAiHints(lead);
  return h.length > 0 ? h[0].textUa : null;
}
