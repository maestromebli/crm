/**
 * Кваліфікація ліда до замовлення (зберігається в Lead.qualification JSON).
 */
export type LeadQualification = {
  furnitureType?: string | null;
  objectType?: string | null;
  budgetRange?: string | null;
  timeline?: string | null;
  temperature?: "cold" | "warm" | "hot" | null;
  decisionStatus?: string | null;
  needsSummary?: string | null;
  /** Адреса об’єкта / виїзду (опційно в JSON кваліфікації). */
  address?: string | null;
};

export function parseLeadQualification(raw: unknown): LeadQualification {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const temp = o.temperature;
  const temperature =
    temp === "cold" || temp === "warm" || temp === "hot" ? temp : null;
  return {
    furnitureType:
      typeof o.furnitureType === "string" ? o.furnitureType : null,
    objectType: typeof o.objectType === "string" ? o.objectType : null,
    budgetRange: typeof o.budgetRange === "string" ? o.budgetRange : null,
    timeline: typeof o.timeline === "string" ? o.timeline : null,
    temperature,
    decisionStatus:
      typeof o.decisionStatus === "string" ? o.decisionStatus : null,
    needsSummary: typeof o.needsSummary === "string" ? o.needsSummary : null,
    address: typeof o.address === "string" ? o.address : null,
  };
}

export function qualificationToJsonPatch(
  q: LeadQualification,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}
