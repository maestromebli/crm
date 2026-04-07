import { prisma } from "../../../lib/prisma";
import type { AiWorkspacePayload } from "./types";

function hoursBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 36e5);
}

function fmtMoney(n: number | null | undefined, cur?: string | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const c = cur?.trim() || "UAH";
  return `${n.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ${c}`;
}

async function buildLeadSnapshot(leadId: string): Promise<AiWorkspacePayload | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      stage: true,
      pipeline: true,
    },
  });
  if (!lead) return null;

  const [proposalRows, estimateRows, tasks, messages, attachments] =
    await Promise.all([
      prisma.leadProposal.findMany({
        where: { leadId },
        orderBy: { version: "desc" },
        take: 4,
        select: {
          version: true,
          status: true,
          sentAt: true,
          approvedAt: true,
          viewedAt: true,
          createdAt: true,
        },
      }),
      prisma.estimate.findMany({
        where: { leadId },
        orderBy: { version: "desc" },
        take: 2,
        select: {
          version: true,
          totalPrice: true,
          status: true,
        },
      }),
      prisma.task.findMany({
        where: {
          entityType: "LEAD",
          entityId: leadId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        select: { dueAt: true, title: true },
      }),
      prisma.leadMessage.findMany({
        where: { leadId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { createdAt: true, body: true, interactionKind: true },
      }),
      prisma.attachment.findMany({
        where: {
          entityType: "LEAD",
          entityId: leadId,
          deletedAt: null,
          isCurrentVersion: true,
        },
        select: {
          id: true,
          fileAiExtraction: {
            select: { processingStatus: true, shortSummary: true },
          },
        },
      }),
    ]);

  const latest = proposalRows[0] ?? null;
  const latestEst = estimateRows[0] ?? null;

  const now = new Date();
  const overdueTasks = tasks.filter(
    (t) => t.dueAt && t.dueAt < now,
  ).length;

  const lastMsgAt = messages[0]?.createdAt ?? null;
  const hoursSinceMsg = lastMsgAt ? hoursBetween(lastMsgAt, now) : null;

  const missing: string[] = [];
  if (!lead.phone?.trim()) missing.push("телефон клієнта");
  if (!lead.contactName?.trim() && !lead.contactId)
    missing.push("ім'я / контакт");
  if (!lead.source?.trim()) missing.push("джерело ліда");

  const risks: string[] = [];
  if (overdueTasks > 0) {
    risks.push(`Є ${overdueTasks} прострочених відкритих задач.`);
  }
  if (
    latest?.status === "SENT" &&
    latest.sentAt &&
    hoursBetween(latest.sentAt, now) >= 48
  ) {
    risks.push(
      "КП надіслано понад 48 год. без підтвердженої відповіді — варто зв’язатися з клієнтом.",
    );
  }
  if (hoursSinceMsg != null && hoursSinceMsg >= 72) {
    risks.push("Давно не було записів у діалозі / таймлайні по цьому ліду.");
  }

  const stageName = lead.stage.name;
  let nextStep = lead.nextStep?.trim() || "";
  if (!nextStep) {
    if (latest?.status === "SENT" || latest?.status === "CLIENT_REVIEWING") {
      nextStep =
        "Зв’язатися з клієнтом щодо КП: відповідь, заперечення, наступний крок.";
    } else if (!latestEst) {
      nextStep =
        "Підготувати або уточнити розрахунок після кваліфікації та файлів.";
    } else if (latest?.status === "DRAFT" || latest?.status === "READY_TO_SEND") {
      nextStep = "Завершити умови КП і надіслати комерційну пропозицію.";
    } else {
      nextStep = "Зафіксувати наступний контакт і оновити етап у воронці.";
    }
  }

  const whatsHappening = `Лід «${lead.title}» на етапі «${stageName}». ${
    latest
      ? `Актуальне КП: v${latest.version}, статус ${latest.status}.`
      : "Комерційних пропозицій ще немає."
  } ${
    latestEst
      ? `Останній розрахунок: v${latestEst.version}, сума ${fmtMoney(latestEst.totalPrice, "UAH")}.`
      : "Розрахунок у системі відсутній."
  }`;

  const confirmedFacts: string[] = [
    `Етап воронки: ${stageName}`,
    `Власник запису (id): ${lead.ownerId}`,
  ];
  if (lead.phone) confirmedFacts.push(`Телефон у картці: ${lead.phone}`);
  if (latest?.sentAt)
    confirmedFacts.push(`КП надіслано: ${latest.sentAt.toISOString()}`);

  const inferredNotes: string[] = [];
  if (latest?.status === "SENT" && !latest.viewedAt) {
    inferredNotes.push(
      "КП ще не відмічено як переглянуте клієнтом (якщо використовується публічне посилання).",
    );
  }

  const aiSummary = [
    whatsHappening,
    missing.length ? `Не вистачає: ${missing.slice(0, 5).join("; ")}.` : "",
    risks.length ? `Ризики: ${risks[0]}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fileProcessing = attachments.filter(
    (a) => a.fileAiExtraction?.processingStatus === "PENDING" ||
      a.fileAiExtraction?.processingStatus === "PROCESSING",
  ).length;
  const fileFailed = attachments.filter(
    (a) => a.fileAiExtraction?.processingStatus === "FAILED",
  ).length;

  const timelineSummary =
    messages.length === 0
      ? "У діалозі ще немає записів."
      : `Останній запис ${hoursSinceMsg != null ? `${hoursSinceMsg} год. тому` : "щойно"}.`;

  const openQuestions: string[] = [];
  if (!latestEst && stageName.toLowerCase().includes("розрах"))
    openQuestions.push("Чи готовий розрахунок до узгодження з клієнтом?");

  return {
    entity: "lead",
    entityId: lead.id,
    title: lead.title,
    stageLabel: stageName,
    pipelineName: lead.pipeline.name,
    generatedAt: now.toISOString(),
    blocks: {
      whatsHappening,
      nextStep,
      missing,
      risks,
      quickHints: [
        "Згенерувати повідомлення клієнту (чат у панелі)",
        "Перевірити файли та підтвердити категорію після аналізу",
        "Перевірити готовність до наступного етапу воронки",
      ],
      aiSummary,
      confirmedFacts,
      inferredNotes,
    },
    modules: {
      timeline: {
        summaryLine: timelineSummary,
        lastClientTouchHours: hoursSinceMsg,
        openQuestions,
      },
      files: {
        total: attachments.length,
        processing: fileProcessing,
        failed: fileFailed,
      },
      estimate: latestEst
        ? {
            version: latestEst.version,
            totalPrice: latestEst.totalPrice,
            hints: [
              estimateRows.length > 1
                ? `Є ${estimateRows.length} версій розрахунку — порівняйте зміни перед КП.`
                : "Перевірте повноту позицій перед відправкою КП.",
            ],
          }
        : {
            version: null,
            totalPrice: null,
            hints: ["Створіть розрахунок або імпортуйте позиції з файлів."],
          },
      quote: {
        status: latest?.status ?? null,
        version: latest?.version ?? null,
        sentAt: latest?.sentAt?.toISOString() ?? null,
        hints:
          latest?.status === "APPROVED"
            ? ["КП узгоджено — можна готувати перехід до угоди."]
            : latest?.status === "SENT"
              ? ["Простежте за відповіддю та зафіксуйте її в діалозі."]
              : ["Підготуйте та надішліть КП після узгодження розрахунку."],
      },
      production: {
        score0to100: null,
        recommendation: "unknown",
        blockers: [],
        warnings: [],
        checklistHint: [
          "Передача у виробництво доступна після конверсії ліда в угоду.",
        ],
      },
    },
  };
}

async function buildDealSnapshot(
  dealId: string,
  options: { showFinance: boolean },
): Promise<AiWorkspacePayload | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      stage: true,
      pipeline: true,
      client: true,
      contract: { select: { status: true } },
    },
  });
  if (!deal) return null;

  const [planRow, lastReady, tasks, attachments] = await Promise.all([
    options.showFinance
      ? prisma.dealPaymentPlan.findUnique({
          where: { dealId },
          select: { stepsJson: true },
        })
      : Promise.resolve(null),
    prisma.readinessEvaluation.findFirst({
      where: { dealId },
      orderBy: { evaluatedAt: "desc" },
      select: {
        outcome: true,
        allMet: true,
        checksJson: true,
        evaluatedAt: true,
      },
    }),
    prisma.task.findMany({
      where: {
        entityType: "DEAL",
        entityId: dealId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: { dueAt: true, title: true },
    }),
    prisma.attachment.findMany({
      where: {
        entityType: "DEAL",
        entityId: dealId,
        deletedAt: null,
        isCurrentVersion: true,
      },
      select: {
        id: true,
        category: true,
        fileAiExtraction: {
          select: { processingStatus: true },
        },
      },
    }),
  ]);

  const milestones =
    planRow?.stepsJson && Array.isArray(planRow.stepsJson)
      ? planRow.stepsJson.map((raw) => {
          const m = raw as {
            label?: string | null;
            amount?: number | null;
            dueDate?: string | null;
            status?: string | null;
            paidAt?: string | null;
          };
          const dueAt = m.dueDate ? new Date(m.dueDate) : null;
          const confirmedAt =
            m.status === "PAID" || m.paidAt
              ? new Date(m.paidAt ?? Date.now())
              : null;
          return {
            label: m.label ?? null,
            amount: m.amount ?? null,
            currency: "UAH" as string | null,
            dueAt,
            confirmedAt,
          };
        })
      : [];

  const now = new Date();
  const overdueTasks = tasks.filter(
    (t) => t.dueAt && t.dueAt < now,
  ).length;

  const missing: string[] = [];
  if (!deal.primaryContactId) missing.push("основний контакт");

  const risks: string[] = [];
  if (overdueTasks > 0)
    risks.push(`Відкриті задачі з простроченим терміном: ${overdueTasks}.`);

  if (options.showFinance && milestones.length > 0) {
    const overdue = milestones.filter(
      (m) => m.dueAt && m.dueAt < now && !m.confirmedAt,
    );
    if (overdue.length)
      risks.push(
        `Є прострочені контрольні дати оплат (${overdue.length}) — перевірте факт оплати.`,
      );
  }

  let score: number | null = null;
  let rec: "ready" | "not_ready" | "partial" | "unknown" = "unknown";
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checklistHint: string[] = [];

  if (lastReady) {
    const checks = lastReady.checksJson as
      | { id?: string; done?: boolean; label?: string }[]
      | null;
    if (Array.isArray(checks) && checks.length > 0) {
      const done = checks.filter((c) => c.done).length;
      score = Math.round((done / checks.length) * 100);
      for (const c of checks) {
        if (!c.done)
          (c.id === "contract_signed" || c.id === "prepayment"
            ? blockers
            : warnings
          ).push(c.label ?? c.id ?? "пункт перевірки");
      }
    } else {
      score = lastReady.allMet ? 85 : 50;
    }
    if (lastReady.outcome === "READY_PRODUCTION") rec = "ready";
    else if (lastReady.outcome === "BLOCKED") rec = "not_ready";
    else rec = "partial";
    checklistHint.push(
      `Остання перевірка готовності: ${lastReady.evaluatedAt.toISOString()}`,
    );
  }

  const whatsHappening = `Угода «${deal.title}» для клієнта «${deal.client.name}», етап «${deal.stage.name}». ${
    deal.contract
      ? `Договір: ${deal.contract.status}.`
      : "Договір ще не створено в системі."
  }`;

  let nextStep =
    "Перевірте робоче місце угоди: файли, оплати та готовність до виробництва.";
  if (rec === "not_ready" || blockers.length)
    nextStep = "Усуньте блокери готовності перед запуском у виробництво.";
  else if (deal.contract?.status === "DRAFT" || !deal.contract)
    nextStep = "Підготуйте та погодьте договір відповідно до узгодженого КП.";

  const confirmedFacts = [
    `Етап: ${deal.stage.name}`,
    `Клієнт: ${deal.client.name}`,
  ];
  if (deal.value != null)
    confirmedFacts.push(
      `Орієнтовна вартість у картці: ${fmtMoney(Number(deal.value), deal.currency)}`,
    );

  const financeMod: AiWorkspacePayload["modules"]["finance"] = options.showFinance
    ? {
        hints: milestones.length
          ? milestones.map((m) => {
              const st = m.confirmedAt
                ? "підтверджено"
                : m.dueAt && m.dueAt < now
                  ? "прострочено (немає підтвердження)"
                  : "очікується";
              const title = m.label?.trim() || "Платіж";
              return `${title}: ${st}, ${fmtMoney(m.amount, m.currency ?? deal.currency ?? "UAH")}`;
            })
          : ["Платіжні етапи ще не задані — перевірте умови в договорі / вкладці оплат."],
      }
    : { hidden: true };

  const aiSummary = [
    whatsHappening,
    risks.length ? `Увага: ${risks[0]}` : "",
    score != null ? `Оцінка готовності (останній знімок): ~${score}%.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fileProcessing = attachments.filter(
    (a) => a.fileAiExtraction?.processingStatus === "PENDING" ||
      a.fileAiExtraction?.processingStatus === "PROCESSING",
  ).length;

  return {
    entity: "deal",
    entityId: deal.id,
    title: deal.title,
    stageLabel: deal.stage.name,
    pipelineName: deal.pipeline.name,
    generatedAt: now.toISOString(),
    blocks: {
      whatsHappening,
      nextStep,
      missing,
      risks,
      quickHints: [
        "Згенерувати нагадування клієнту про оплату (за наявності заборгованості)",
        "Перевірити відповідність договору та КП",
        "Переглянути готовність до виробництва",
      ],
      aiSummary,
      confirmedFacts,
      inferredNotes: [],
    },
    modules: {
      files: {
        total: attachments.length,
        processing: fileProcessing,
        failed: attachments.filter(
          (a) => a.fileAiExtraction?.processingStatus === "FAILED",
        ).length,
      },
      contract: {
        status: deal.contract?.status ?? null,
        hints: deal.contract
          ? ["Переконайтесь, що підписаний PDF зберігається у вкладці договору."]
          : ["Створіть договір з узгоджених умов."],
      },
      finance: financeMod,
      production: {
        score0to100: score,
        recommendation: rec,
        blockers,
        warnings,
        checklistHint,
      },
    },
  };
}

export async function buildAiWorkspaceSnapshot(input: {
  leadId?: string | null;
  dealId?: string | null;
  showFinance: boolean;
}): Promise<AiWorkspacePayload | null> {
  if (input.leadId) return buildLeadSnapshot(input.leadId);
  if (input.dealId)
    return buildDealSnapshot(input.dealId, { showFinance: input.showFinance });
  return null;
}
