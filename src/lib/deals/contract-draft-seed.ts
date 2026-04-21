import type { DealContractDraft } from "@/lib/deal-core/workspace-types";
import type { DealContractRecipientType } from "@/lib/deal-core/workspace-types";
import {
  DEAL_DOCUMENT_TEMPLATES,
  makeDefaultDraft,
  type DealDocumentTemplate,
} from "@/lib/deals/document-templates";

/** Дані замовлення для підстановки в змінні договору (без Prisma-типів). */
export type DealForContractSeed = {
  id: string;
  title: string;
  value: number | null;
  currency: string | null;
  expectedCloseDate: Date | null;
  description: string | null;
  client: { name: string; type: string };
  primaryContact: {
    fullName: string;
    city: string | null;
    country: string | null;
  } | null;
  owner: { name: string | null; email: string };
  paymentMilestones?: Array<{
    label: string | null;
    amount: number | null;
    currency: string | null;
  }>;
};

const MONTHS_GENITIVE_UK = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
] as const;

function pickNonEmpty(...vals: (string | undefined | null)[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function formatMoneyUk(n: number): string {
  return n.toLocaleString("uk-UA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatPaymentMilestones(
  milestones: DealForContractSeed["paymentMilestones"],
): string | null {
  if (!milestones?.length) return null;
  const parts: string[] = [];
  for (const m of milestones) {
    const label = m.label?.trim() || "Етап";
    const a =
      m.amount != null && Number.isFinite(m.amount)
        ? `${m.amount.toLocaleString("uk-UA")} ${(m.currency ?? "").trim()}`.trim()
        : "";
    if (a) parts.push(`${label}: ${a}`);
    else if (m.label?.trim()) parts.push(label);
  }
  return parts.length ? parts.join("; ") : null;
}

/**
 * Заповнює порожні змінні з контексту замовлення (без перезапису вже введених значень).
 */
export function mergeDealContextIntoContractVariables(
  base: Record<string, string>,
  ctx: DealForContractSeed,
): Record<string, string> {
  const today = new Date().toLocaleDateString("uk-UA");
  const refDate = new Date();
  const contractNumberFallback = `DL-${ctx.id.slice(-6).toUpperCase()}`;
  const valueNum = ctx.value != null && Number.isFinite(ctx.value) ? ctx.value : null;
  const currency = (ctx.currency ?? "UAH").trim() || "UAH";
  const isCompany = ctx.client.type === "COMPANY";
  const customerLabel = isCompany
    ? ctx.client.name
    : pickNonEmpty(ctx.primaryContact?.fullName, ctx.client.name);
  const customerFullNameForContract = isCompany
    ? ctx.client.name
    : pickNonEmpty(ctx.primaryContact?.fullName, ctx.client.name);
  const addressHint = pickNonEmpty(
    [ctx.primaryContact?.city, ctx.primaryContact?.country]
      .filter(Boolean)
      .join(", "),
    ctx.description ?? undefined,
  );
  const paymentMilestoneText = formatPaymentMilestones(ctx.paymentMilestones);
  const closeYear = ctx.expectedCloseDate
    ? new Date(ctx.expectedCloseDate).getFullYear()
    : refDate.getFullYear();

  const out: Record<string, string> = { ...base };
  const set = (k: string, val: string) => {
    if (!(out[k] ?? "").trim()) out[k] = val;
  };

  set("clientName", ctx.client.name);
  set("dealNumber", contractNumberFallback);
  set("contractNumber", contractNumberFallback);
  set("contractDate", today);
  set("customerFullName", customerFullNameForContract);
  set(
    "customerPartyLabel",
    isCompany ? "ЮРИДИЧНА ОСОБА" : "ГРОМАДЯНИН УКРАЇНИ",
  );
  set(
    "customerTaxId",
    isCompany ? "ЄДРПОУ уточнюється" : "РНОКПП уточнюється",
  );
  set("customerAddress", addressHint || "уточнюється");
  set("contractSubject", ctx.title);
  let contractAmountDisplay = "";
  if (valueNum != null) {
    contractAmountDisplay = formatMoneyUk(valueNum);
    if (currency && currency !== "UAH") {
      contractAmountDisplay = `${contractAmountDisplay} ${currency}`.trim();
    }
  }
  set("contractAmount", contractAmountDisplay || "уточнюється");
  set("contractAmountWords", "уточнюється");
  set("contractCity", pickNonEmpty(ctx.primaryContact?.city, "Київ"));
  set("contractDay", String(refDate.getDate()));
  set("contractMonth", MONTHS_GENITIVE_UK[refDate.getMonth()]);
  set("contractYear", String(refDate.getFullYear()));
  set(
    "contractDateShort",
    `${refDate.getDate()} ${MONTHS_GENITIVE_UK[refDate.getMonth()]} ${refDate.getFullYear()} р.`,
  );
  set("objectAddress", addressHint || "уточнюється");
  set("advancePercent", "70");
  set("remainderPercent", "30");
  if (valueNum != null) {
    const adv = Math.round(valueNum * 0.7 * 100) / 100;
    const rem = Math.round(valueNum * 0.3 * 100) / 100;
    set("advanceAmount", formatMoneyUk(adv));
    set("remainderAmount", formatMoneyUk(rem));
  } else {
    set("advanceAmount", "уточнюється");
    set("remainderAmount", "уточнюється");
  }
  set("advanceAmountWords", "уточнюється");
  set("remainderAmountWords", "уточнюється");
  set("contractValidUntil", `31 грудня ${closeYear} року`);
  set(
    "executionTerm",
    ctx.expectedCloseDate
      ? `до ${new Date(ctx.expectedCloseDate).toLocaleDateString("uk-UA")}`
      : "за погодженим графіком",
  );
  if (paymentMilestoneText) {
    set("paymentTerms", paymentMilestoneText);
  } else {
    set(
      "paymentTerms",
      "Оплата згідно погодженого графіка віх у вкладці «Оплата».",
    );
  }

  const ownerName = pickNonEmpty(ctx.owner.name, ctx.owner.email);
  set("contractorFullName", ownerName || "уточнюється");
  set("contractorTaxId", "уточнюється");
  set("contractorAddress", "уточнюється");

  return out;
}

export function enrichContractDraftFromDeal(
  draft: DealContractDraft,
  deal: DealForContractSeed,
): DealContractDraft {
  return {
    ...draft,
    variables: mergeDealContextIntoContractVariables(
      draft.variables ?? {},
      deal,
    ),
  };
}

/** Шаблон за замовчуванням для нового договору: зразок поставки (HTML), інакше E-52. */
export function defaultContractTemplateForAutomation(): DealDocumentTemplate {
  return (
    DEAL_DOCUMENT_TEMPLATES.find((t) => t.key === "contract_supply_goods_zrazok_html") ??
    DEAL_DOCUMENT_TEMPLATES.find((t) => t.key === "contract_enver_e52_diia_docx") ??
    DEAL_DOCUMENT_TEMPLATES[0]
  );
}

/** Зведення рядка замовлення з Prisma у форму для сиду договору. */
export function toDealForContractSeed(
  deal: {
    id: string;
    title: string;
    value: unknown | null;
    currency: string | null;
    expectedCloseDate: Date | null;
    description: string | null;
    client: { name: string; type: string };
    primaryContact: {
      fullName: string;
      city: string | null;
      country: string | null;
    } | null;
    owner: { name: string | null; email: string };
    paymentMilestones?: Array<{
      label: string | null;
      amount: number | null;
      currency: string | null;
    }>;
  },
): DealForContractSeed {
  return {
    id: deal.id,
    title: deal.title,
    value: deal.value != null ? Number(deal.value) : null,
    currency: deal.currency,
    expectedCloseDate: deal.expectedCloseDate,
    description: deal.description,
    client: deal.client,
    primaryContact: deal.primaryContact,
    owner: deal.owner,
    paymentMilestones: deal.paymentMilestones,
  };
}

export function buildSeededContractDraft(args: {
  deal: DealForContractSeed;
  recipientType: DealContractRecipientType;
  template?: DealDocumentTemplate;
}): DealContractDraft {
  const tpl = args.template ?? defaultContractTemplateForAutomation();
  const base = makeDefaultDraft({
    template: tpl,
    clientName: args.deal.client.name,
    dealTitle: args.deal.title,
    dealValue: args.deal.value,
    dealCurrency: args.deal.currency ?? "UAH",
    recipientType: args.recipientType,
  });
  return enrichContractDraftFromDeal(base, args.deal);
}
