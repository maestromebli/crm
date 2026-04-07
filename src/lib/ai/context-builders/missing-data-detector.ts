type GenericJson = Record<string, unknown>;

function asObject(value: unknown): GenericJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GenericJson;
}

function getString(obj: GenericJson, key: string): string | null {
  const v = obj[key];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export function detectLeadMissingData(input: {
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  qualification?: unknown;
}): string[] {
  const missing: string[] = [];
  if (!input.contactName?.trim()) missing.push("Не заповнено ім'я контакту");
  if (!input.phone?.trim() && !input.email?.trim()) {
    missing.push("Немає телефону або email для контакту");
  }

  const q = asObject(input.qualification);
  const budget = getString(q, "budget") ?? getString(q, "budgetRange");
  const deadline = getString(q, "deadline") ?? getString(q, "targetDate");
  if (!budget) missing.push("Не вказано бюджет");
  if (!deadline) missing.push("Не вказано дедлайн");

  return missing;
}

export function detectDealMissingData(input: {
  expectedCloseDate?: Date | null;
  value?: unknown;
  controlMeasurementJson?: unknown;
}): string[] {
  const missing: string[] = [];
  if (!input.expectedCloseDate) missing.push("Не вказано очікувану дату закриття");
  if (input.value == null) missing.push("Не вказано суму угоди");

  const measurement = asObject(input.controlMeasurementJson);
  const measurementDone =
    measurement.done === true ||
    measurement.completed === true ||
    getString(measurement, "status") === "done";
  if (!measurementDone) missing.push("Контрольний замір не підтверджено");

  return missing;
}
