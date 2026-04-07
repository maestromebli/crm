import type { InboxFilterTab } from "../features/inbox/components/ConversationFilters";
import type { InboxChannel } from "../features/inbox/types";

export type InboxRouteResolved = {
  initialTab: InboxFilterTab;
  channelFilter: InboxChannel | null;
};

/**
 * Мапінг /inbox/[[...slug]] → таб та фільтр каналу (як у NAV_SECTIONS).
 */
export function inboxRouteConfig(slug?: string[]): InboxRouteResolved {
  const key = slug?.[0];
  const base: InboxRouteResolved = {
    initialTab: "all",
    channelFilter: null,
  };

  const map: Record<string, Partial<InboxRouteResolved>> = {
    unread: { initialTab: "unread" },
    unanswered: { initialTab: "unanswered" },
    overdue: { initialTab: "overdue" },
    mine: { initialTab: "mine" },
    unlinked: { initialTab: "unlinked" },
    telegram: { initialTab: "all", channelFilter: "telegram" },
    instagram: { initialTab: "all", channelFilter: "instagram" },
  };

  if (!key) return base;
  return { ...base, ...map[key] };
}
