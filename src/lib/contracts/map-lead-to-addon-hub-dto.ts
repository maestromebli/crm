import type { LeadDetailRow } from "../../features/leads/queries";
import type { LeadReadinessRow } from "../leads/lead-readiness-rows";
import { deriveLeadReadinessRecommendation } from "../leads/lead-readiness-rows";
import type { LeadHubDto, ReadinessState } from "./addon-ui-backend-contracts";

function rowStateToAddon(s: LeadReadinessRow["state"]): ReadinessState {
  if (s === "ready") return "READY";
  if (s === "partial") return "PARTIAL";
  return "MISSING";
}

function formatMoneyUa(total: number | null): string {
  if (total == null || Number.isNaN(total)) return "—";
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 0,
  }).format(total);
}

function shortLeadCode(leadId: string): string {
  return leadId.length > 10 ? `…${leadId.slice(-8)}` : leadId;
}

function readinessFromRows(rows: LeadReadinessRow[]): LeadHubDto["readiness"] {
  const byKey = (k: string) => rows.find((r) => r.key === k);
  const contact = rowStateToAddon(byKey("contact")?.state ?? "missing");
  const budget = rowStateToAddon(byKey("budget")?.state ?? "missing");
  const estimate = rowStateToAddon(byKey("estimate")?.state ?? "missing");
  const proposal = rowStateToAddon(byKey("commercial")?.state ?? "missing");
  const nextStep = rowStateToAddon(byKey("next")?.state ?? "missing");
  const files = rowStateToAddon(byKey("files")?.state ?? "missing");
  const summary = deriveLeadReadinessRecommendation(rows);
  const missing = rows.filter((r) => r.state === "missing");
  const partial = rows.filter((r) => r.state === "partial");
  const suggested =
    missing[0]?.hint ??
    partial[0]?.hint ??
    undefined;
  return {
    contact,
    budget,
    estimate,
    proposal,
    nextStep,
    files,
    summary,
    ...(suggested ? { suggestedAction: suggested } : {}),
  };
}

export type MapLeadToAddonHubDtoOpts = {
  /** Якщо не передано — рядки готовності будуть зібрані з `lead` через імпортовану логіку не тут; передайте `readinessRows` з `computeLeadReadinessRows(lead)`. */
  readinessRows: LeadReadinessRow[];
  /** Підставки для `aiInsights` (наприклад з `LeadHubApiResponse.aiInsights`). */
  aiInsights?: LeadHubDto["aiInsights"];
};

/**
 * Перетворює `LeadDetailRow` + рядки готовності у форму add-on `LeadHubDto`.
 * Використовуйте разом із `computeLeadReadinessRows` з `lib/leads/lead-readiness-rows`.
 */
export function mapLeadDetailToAddonHubDto(
  lead: LeadDetailRow,
  opts: MapLeadToAddonHubDtoOpts,
): LeadHubDto {
  const q = lead.qualification;
  const qualJson: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null) qualJson[k] = v;
  }

  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;

  const contacts: LeadHubDto["contacts"] = [];
  if (lead.contact) {
    const msg: Record<string, string> = {};
    if (lead.contact.instagramHandle?.trim()) {
      msg.instagram = lead.contact.instagramHandle.trim();
    }
    if (lead.contact.telegramHandle?.trim()) {
      msg.telegram = lead.contact.telegramHandle.trim();
    }
    contacts.push({
      id: lead.contact.id,
      fullName: lead.contact.fullName,
      phone: lead.contact.phone?.trim() ?? null,
      email: lead.contact.email?.trim() ?? null,
      isPrimary: true,
      messengers: Object.keys(msg).length ? msg : null,
    });
  }
  for (const lc of lead.leadContacts) {
    if (lead.contact && lc.contactId === lead.contact.id) continue;
    contacts.push({
      id: lc.contactId,
      fullName: lc.fullName,
      phone: null,
      email: null,
      isPrimary: lc.isPrimary,
      messengers: null,
    });
  }

  const est = lead.estimates[0] ?? null;
  const prop = lead.proposals[0] ?? null;
  const estForProposal =
    prop && prop.estimateId
      ? lead.estimates.find((e) => e.id === prop.estimateId) ?? est
      : est;

  return {
    lead: {
      id: lead.id,
      title: lead.title,
      code: shortLeadCode(lead.id),
      status: lead.stage.name,
      source: lead.source,
      phone,
      nextActionText: lead.nextStep?.trim() || null,
      nextActionAt: lead.nextContactAt?.toISOString() ?? null,
      assignedManager: lead.owner.name
        ? { id: lead.ownerId, fullName: lead.owner.name }
        : { id: lead.ownerId, fullName: lead.owner.email },
      expectedValue: q.budgetRange?.trim() || null,
      temperature: q.temperature ?? null,
      projectType: q.furnitureType?.trim() || null,
      objectType: q.objectType?.trim() || null,
      qualificationJson: Object.keys(qualJson).length ? qualJson : null,
    },
    readiness: readinessFromRows(opts.readinessRows),
    contacts,
    currentEstimate: est
      ? {
          id: est.id,
          version: est.version,
          total: formatMoneyUa(est.totalPrice),
          status: est.status,
          updatedAt: est.updatedAt.toISOString(),
        }
      : null,
    latestProposal: prop
      ? {
          id: prop.id,
          version: prop.version,
          status: prop.status,
          total: formatMoneyUa(estForProposal?.totalPrice ?? null),
          viewedAt: prop.viewedAt?.toISOString() ?? null,
          sentAt: prop.sentAt?.toISOString() ?? null,
        }
      : null,
    tasks: [],
    meetings: lead.calendarEvents.map((e) => ({
      id: e.id,
      type: e.type,
      status: e.status,
      scheduledAt: e.startAt,
      resultSummary: null,
    })),
    files: lead.attachments.map((a) => ({
      id: a.id,
      name: a.fileName,
      category: a.category,
      createdAt: a.createdAt,
    })),
    recentActivities: [],
    aiInsights: opts.aiInsights ?? [],
  };
}
