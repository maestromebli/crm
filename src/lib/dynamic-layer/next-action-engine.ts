import type { DynamicNextAction } from "./types";

type RuleInput = {
  hasContact: boolean;
  hasEstimate: boolean;
  quoteSentAt: string | null;
  now?: Date;
};

const FOLLOW_UP_MS = 48 * 60 * 60 * 1000;

export function deriveDynamicNextAction(input: RuleInput): DynamicNextAction | null {
  if (!input.hasContact) {
    return {
      label: "Додати контакт",
      action: "open_contact_form",
      priority: "high",
    };
  }

  if (!input.hasEstimate) {
    return {
      label: "Створити прорахунок",
      action: "open_estimate_workspace",
      priority: "high",
    };
  }

  if (input.quoteSentAt) {
    const sentAt = new Date(input.quoteSentAt);
    if (!Number.isNaN(sentAt.getTime())) {
      const now = input.now ?? new Date();
      if (now.getTime() - sentAt.getTime() >= FOLLOW_UP_MS) {
        return {
          label: "Зробити наступний контакт по КП",
          action: "create_follow_up_task",
          priority: "medium",
        };
      }
    }
  }

  return null;
}
