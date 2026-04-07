export type TimelineEventKind =
  | "file"
  | "task"
  | "quote"
  | "contract"
  | "payment"
  | "communication"
  | "measurement"
  | "ai"
  | "other";

export function timelineKindFromEventType(type: string): TimelineEventKind {
  const normalized = type.toLowerCase();
  if (normalized.includes("file")) return "file";
  if (normalized.includes("task")) return "task";
  if (normalized.includes("quote") || normalized.includes("proposal")) return "quote";
  if (normalized.includes("contract")) return "contract";
  if (normalized.includes("payment") || normalized.includes("invoice")) return "payment";
  if (normalized.includes("message") || normalized.includes("telegram")) return "communication";
  if (normalized.includes("measurement")) return "measurement";
  if (normalized.includes("ai")) return "ai";
  return "other";
}

export function timelineWeight(type: string): number {
  const kind = timelineKindFromEventType(type);
  switch (kind) {
    case "payment":
    case "contract":
    case "quote":
      return 3;
    case "measurement":
    case "task":
      return 2;
    case "file":
    case "communication":
    case "ai":
      return 1;
    default:
      return 0;
  }
}
