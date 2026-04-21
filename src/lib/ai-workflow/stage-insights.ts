import type { DealContractStatus } from "@prisma/client";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import type { DealStageAiId, DealStageInsight } from "./types";

type Input = {
  stage: DealStageAiId;
  meta: DealWorkspaceMeta;
  productionLaunchStatus?: "NOT_READY" | "QUEUED" | "LAUNCHING" | "LAUNCHED" | "FAILED";
  readinessAllMet: boolean;
  handoffStatus: "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
  contractStatus: DealContractStatus | null;
  attachmentsByCategory: Record<string, number>;
  estimatesCount: number;
};

function baseInsight(stage: DealStageAiId): DealStageInsight {
  return {
    stage,
    summary: "Етап у стабільному стані.",
    confidence: 0.72,
    nextAction: "Перевірити актуальність даних етапу та перейти до наступного кроку.",
    risks: [],
    recommendedUpdates: [],
  };
}

export function buildDealStageInsight(input: Input): DealStageInsight {
  const out = baseInsight(input.stage);

  if (input.stage === "qualification") {
    const done = Boolean(input.meta.qualificationComplete);
    out.summary = done
      ? "Кваліфікація завершена, можна рухати замовлення далі."
      : "Кваліфікація не завершена і блокує подальші кроки.";
    out.confidence = done ? 0.87 : 0.93;
    out.nextAction = done
      ? "Підтвердити замір і підготувати КП."
      : "Закрити кваліфікацію та зберегти структуровану нотатку.";
    if (!done) out.risks.push("Втрата контексту вимог клієнта через незавершену кваліфікацію.");
    if (!done) out.recommendedUpdates.push("Позначити `qualificationComplete=true` та додати qualificationNotes.");
    return out;
  }

  if (input.stage === "measurement") {
    const done = Boolean(input.meta.measurementComplete);
    const hasSheet =
      (input.attachmentsByCategory.MEASUREMENT_SHEET ?? 0) > 0 ||
      (input.attachmentsByCategory.DRAWING ?? 0) > 0;
    out.summary = done && hasSheet
      ? "Дані заміру підтверджені документально."
      : "Етап заміру потребує завершення або документів.";
    out.confidence = done && hasSheet ? 0.89 : 0.9;
    out.nextAction = done && hasSheet
      ? "Перевірити узгодження смети/КП."
      : "Додати лист заміру/креслення і підтвердити measurementComplete.";
    if (!done) out.risks.push("Помилки у кошторисі через неповний замір.");
    if (!hasSheet) out.risks.push("Відсутні технічні документи заміру.");
    if (!done) out.recommendedUpdates.push("Зберегти `measurementNotes` та встановити `measurementComplete`.");
    return out;
  }

  if (input.stage === "proposal") {
    const sent = Boolean(input.meta.proposalSent);
    out.summary = sent
      ? "Комерційна пропозиція відправлена клієнту."
      : "КП ще не зафіксовано як відправлену.";
    out.confidence = sent ? 0.82 : 0.88;
    out.nextAction = sent
      ? "Контролювати зворотний зв'язок клієнта і підписання."
      : "Завершити смету та відправити КП клієнту.";
    if (input.estimatesCount === 0) out.risks.push("Немає жодної смети для коректного КП.");
    if (!sent) out.recommendedUpdates.push("Позначити `proposalSent=true` після відправки.");
    return out;
  }

  if (input.stage === "contract") {
    const full = input.contractStatus === "FULLY_SIGNED";
    out.summary = full
      ? "Договір повністю підписано."
      : "Договір не доведений до стану повного підписання.";
    out.confidence = full ? 0.9 : 0.92;
    out.nextAction = full
      ? "Перевірити оплату і передачу."
      : "Перевести договір у FULLY_SIGNED або зафіксувати blocker.";
    if (!full) out.risks.push("Запуск у виробництво буде заблоковано readiness-правилами.");
    return out;
  }

  if (input.stage === "payment") {
    const milestones = input.meta.payment?.milestones ?? [];
    const hasDone = milestones.some((m) => m.done);
    out.summary = hasDone
      ? "Є підтверджені платежі у віхах оплати."
      : "Підтверджені платежі відсутні.";
    out.confidence = hasDone ? 0.83 : 0.9;
    out.nextAction = hasDone
      ? "Підтримувати актуальність графіка оплат."
      : "Зафіксувати підтвердження передоплати у payment milestones.";
    if (!hasDone) out.risks.push("Неможливість запуску у виробництво через відсутність підтвердження оплати.");
    return out;
  }

  if (input.stage === "handoff") {
    const ready = Boolean(input.meta.handoffPackageReady);
    const accepted = input.handoffStatus === "ACCEPTED";
    out.summary = accepted
      ? "Пакет передачі прийнято виробництвом."
      : ready
        ? "Пакет зібраний і очікує прийняття."
        : "Пакет передачі ще не готовий.";
    out.confidence = accepted ? 0.93 : 0.86;
    out.nextAction = accepted
      ? "Ініціювати запуск у виробництво."
      : ready
        ? "Надіслати/довести пакет до статусу ACCEPTED."
        : "Завершити комплектування пакета передачі.";
    if (!ready) out.risks.push("Ризик затримки через неповний handoff-пакет.");
    if (!accepted) out.recommendedUpdates.push("Перевести handoff у статус ACCEPTED після перевірки.");
    return out;
  }

  if (input.stage === "production") {
    const launched = input.productionLaunchStatus === "LAUNCHED";
    out.summary = launched
      ? "Виробництво запущено."
      : input.readinessAllMet
        ? "Замовлення готова до запуску у виробництво."
        : "Замовлення ще не готова до запуску у виробництво.";
    out.confidence = launched ? 0.95 : 0.9;
    out.nextAction = launched
      ? "Контролювати виконання у виробничій черзі."
      : "Закрити blocker-и readiness та підтвердити handoff.";
    if (!input.readinessAllMet) out.risks.push("Readiness блокери не дозволять production launch.");
    if (!launched) out.recommendedUpdates.push("Виконати `POST /api/deals/[dealId]/production-launch`.");
  }

  return out;
}
