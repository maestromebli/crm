import { getStageConfig } from "./lead-stage.config";
import { evaluateLeadChecksForStage, evaluateLeadCheck } from "./lead-checks";
import type { LeadCoreInput } from "./lead-input.types";
import type {
  CoreReadinessLevel,
  LeadCheckResult,
  LeadReadinessItemResult,
  LeadReadinessResult,
} from "./lead-stage.types";
import type { LeadStageKey } from "./lead-stage.types";

function buildLegacyRows(lead: LeadCoreInput): LeadReadinessItemResult[] {
  const rContact = evaluateLeadCheck("contact_channel", "required", lead);
  const rBudget = evaluateLeadCheck("budget_range_documented", "soft", lead);
  const rEst = evaluateLeadCheck("estimate_exists", "required", lead);
  const rActive = evaluateLeadCheck("active_estimate", "required", lead);
  const prop = lead.commercial.latestProposal;
  const est = lead.commercial.latestEstimate;
  let commercialState: LeadReadinessItemResult["state"] = "missing";
  let commercialHint: string | null = "Створіть прорахунок і КП";
  if (prop?.status === "APPROVED") {
    commercialState = "ready";
    commercialHint = "КП погоджено";
  } else if (prop && (prop.status === "SENT" || prop.status === "CLIENT_REVIEWING")) {
    commercialState = "partial";
    commercialHint = "КП надіслано — очікуйте відповідь";
  } else if (est && prop?.status === "DRAFT") {
    commercialState = "partial";
    commercialHint = "Чернетка КП";
  } else if (est) {
    commercialState = "partial";
    commercialHint = "Оформіть КП";
  }

  const rNextText = evaluateLeadCheck("next_step_text", "required", lead);
  const rNextDate = evaluateLeadCheck("next_contact_date", "soft", lead);
  let nextState: LeadReadinessItemResult["state"] = "missing";
  if (rNextText.pass && rNextDate.pass) nextState = "ready";
  else if (rNextText.pass || rNextDate.pass) nextState = "partial";

  const rFiles = evaluateLeadCheck("key_files_present", "soft", lead);

  return [
    {
      key: "contact",
      labelUa: "Контакт",
      state: rContact.pass ? "ready" : "missing",
      hintUa: rContact.hintUa,
    },
    {
      key: "budget",
      labelUa: "Бюджет",
      state: rBudget.pass ? "ready" : lead.qualification.needsSummary?.trim()
        ? "partial"
        : "missing",
      hintUa: rBudget.hintUa,
    },
    {
      key: "estimate",
      labelUa: "Смета",
      state:
        rEst.pass && rActive.pass
          ? "ready"
          : rEst.pass
            ? "partial"
            : "missing",
      hintUa: !rEst.pass ? "Без прорахунку важко закривати" : rActive.hintUa,
    },
    {
      key: "commercial",
      labelUa: "КП / комерція",
      state: commercialState,
      hintUa: commercialHint,
    },
    {
      key: "next",
      labelUa: "Наступний крок",
      state: nextState,
      hintUa:
        nextState === "missing"
          ? "Текст і дата контакту"
          : nextState === "partial"
            ? "Доповніть крок або дату"
            : null,
    },
    {
      key: "files",
      labelUa: "Ключові файли",
      state: rFiles.pass ? "ready" : lead.files.attachmentCount === 1 ? "partial" : "missing",
      hintUa: rFiles.hintUa,
    },
  ];
}

function headlineForLevel(
  level: CoreReadinessLevel,
  stageKey: LeadStageKey,
): string {
  const cfg = getStageConfig(stageKey);
  if (level === "ready") {
    return `Готово до наступного кроку: ${cfg.labelUa}`;
  }
  if (level === "partial") {
    return "Можна рухатись далі, але є рекомендовані поля";
  }
  return "Є блокери для поточної стадії — закрийте обов’язкові пункти";
}

/**
 * Повна готовність ліда з урахуванням канонічної стадії та уніфікованих перевірок.
 */
export function computeLeadReadiness(lead: LeadCoreInput): LeadReadinessResult {
  const cfg = getStageConfig(lead.stageKey);
  const { required, soft } = evaluateLeadChecksForStage(
    lead,
    cfg.requiredChecks,
    cfg.softChecks,
  );

  const reqFailed = required.filter((x) => !x.pass);
  const softFailed = soft.filter((x) => !x.pass);

  let level: CoreReadinessLevel;
  if (reqFailed.length > 0) level = "blocked";
  else if (softFailed.length > 0) level = "partial";
  else level = "ready";

  const blockers = reqFailed;
  const softWarnings = softFailed;

  return {
    level,
    headlineUa: headlineForLevel(level, lead.stageKey),
    items: buildLegacyRows(lead),
    blockers,
    softWarnings,
  };
}

export function readinessBlockerMessages(results: LeadCheckResult[]): string[] {
  return results.filter((r) => !r.pass).map((r) => r.hintUa ?? r.labelUa);
}
