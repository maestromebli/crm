import { leadFirstTouchSlaMinutes } from "./lead-sla";
import { normalizePhoneDigits, phonesLikelySame } from "./phone-normalize";

/** Мінімальні поля для обчислення статусів у списку (без циклу з queries). */
export type LeadMetaInput = {
  id: string;
  phone: string | null;
  nextStep: string | null;
  nextContactAt: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date;
  stage: { slug: string; isFinal: boolean };
};

export type LeadResponseStatusKey =
  | "NEW"
  | "DUE_SOON"
  | "OVERDUE_TOUCH"
  | "IN_PROGRESS"
  | "SCHEDULED"
  | "CLOSED";

export function leadResponseStatus(row: LeadMetaInput): {
  key: LeadResponseStatusKey;
  label: string;
} {
  if (row.stage.isFinal) {
    return { key: "CLOSED", label: "Закрито" };
  }
  const now = Date.now();
  const nc = row.nextContactAt ? new Date(row.nextContactAt).getTime() : null;
  if (nc != null && nc < now) {
    return { key: "OVERDUE_TOUCH", label: "Прострочено контакт" };
  }
  if (nc != null && nc >= now) {
    return { key: "SCHEDULED", label: "Заплановано" };
  }
  const slaMs = leadFirstTouchSlaMinutes() * 60_000;
  const created = new Date(row.createdAt).getTime();
  const noTouch = row.lastActivityAt == null;
  if (row.stage.slug === "new" && noTouch && now - created > slaMs) {
    return { key: "OVERDUE_TOUCH", label: "Без відповіді (SLA)" };
  }
  if (row.stage.slug === "new" && noTouch) {
    return { key: "NEW", label: "Новий" };
  }
  if (row.lastActivityAt) {
    return { key: "IN_PROGRESS", label: "В роботі" };
  }
  return { key: "DUE_SOON", label: "Очікує дії" };
}

export type LeadWarningLevel = "critical" | "warning" | null;

export function leadWarningLevel(
  row: LeadMetaInput,
  duplicatePhone: boolean,
): { level: LeadWarningLevel; hints: string[] } {
  const hints: string[] = [];
  let level: LeadWarningLevel = null;

  const push = (l: "critical" | "warning", msg: string) => {
    hints.push(msg);
    if (l === "critical") level = "critical";
    else if (level !== "critical") level = "warning";
  };

  if (duplicatePhone) {
    push("warning", "Можливий дубль телефону");
  }

  const hasNext =
    Boolean(row.nextStep?.trim()) || row.nextContactAt != null;
  if (!row.stage.isFinal && !hasNext) {
    push("warning", "Немає наступного кроку");
  }

  const rs = leadResponseStatus(row);
  if (rs.key === "OVERDUE_TOUCH") {
    push("critical", rs.label);
  }

  return { level, hints };
}

export function duplicateLeadIdsByPhone(
  rows: Pick<LeadMetaInput, "id" | "phone">[],
): Set<string> {
  const dup = new Set<string>();
  const withPhone = rows.filter((r) => normalizePhoneDigits(r.phone));
  for (let i = 0; i < withPhone.length; i++) {
    for (let j = i + 1; j < withPhone.length; j++) {
      const a = withPhone[i];
      const b = withPhone[j];
      if (phonesLikelySame(a.phone ?? "", b.phone ?? "")) {
        dup.add(a.id);
        dup.add(b.id);
      }
    }
  }
  return dup;
}
