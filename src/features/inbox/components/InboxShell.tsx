"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { InboxChannel, InboxConversation } from "../types";
import { ConversationListItem } from "./ConversationListItem";
import {
  ConversationFilters,
  type InboxFilterTab,
} from "./ConversationFilters";
import { ConversationView } from "./ConversationView";
import { ConversationSidebar } from "./ConversationSidebar";
import { cn } from "../../../lib/utils";

const demoConversations: InboxConversation[] = [
  {
    id: "c1",
    customerName: "Олександр · ЖК RIVER",
    customerHandle: "@olexander_river",
    channel: "telegram",
    lastMessagePreview:
      "Добрий день! Коли зможемо затвердити фінальний варіант кухні?",
    lastMessageAt: "10 хв тому",
    unreadCount: 2,
    hasUnanswered: true,
    slaState: "warning",
    status: "open",
    assignee: "Марина",
    linkedEntityType: "deal",
    linkedEntityLabel: "Кухня · ЖК RIVER",
    messages: [
      {
        id: "m1",
        direction: "in",
        text: "Добрий день! Коли зможемо затвердити фінальний варіант кухні?",
        createdAt: "2026-03-17T09:30:00.000Z",
      },
      {
        id: "m2",
        direction: "in",
        text: "Мені важливо розуміти терміни виробництва.",
        createdAt: "2026-03-17T09:32:00.000Z",
      },
    ],
  },
  {
    id: "c2",
    customerName: "Studio Loft",
    customerHandle: "@studio_loft",
    channel: "telegram",
    lastMessagePreview:
      "Надішліть, будь ласка, варіанти фасадів у темному кольорі.",
    lastMessageAt: "32 хв тому",
    unreadCount: 0,
    hasUnanswered: false,
    slaState: "ok",
    status: "waiting_client",
    assignee: "Антон",
    linkedEntityType: "lead",
    linkedEntityLabel: "Лід · Studio Loft · офіс",
    messages: [
      {
        id: "m3",
        direction: "in",
        text: "Надішліть, будь ласка, варіанти фасадів у темному кольорі.",
        createdAt: "2026-03-17T10:15:00.000Z",
      },
      {
        id: "m4",
        direction: "out",
        text: "Я підготую 3 варіанти і надішлю вам сьогодні до 18:00.",
        createdAt: "2026-03-17T10:17:00.000Z",
      },
    ],
  },
  {
    id: "c3",
    customerName: "Дмитро · гардеробна",
    customerHandle: "@dmytro_wardrobe",
    channel: "telegram",
    lastMessagePreview:
      "Добре, чекаю на оновлений розрахунок з іншим матеріалом.",
    lastMessageAt: "Вчора",
    unreadCount: 0,
    hasUnanswered: false,
    slaState: "ok",
    status: "open",
    assignee: "Марина",
    linkedEntityType: "lead",
    linkedEntityLabel: "Лід · гардеробна котедж",
    messages: [
      {
        id: "m5",
        direction: "out",
        text: "Надіслав вам оновлений розрахунок по гардеробній.",
        createdAt: "2026-03-16T14:05:00.000Z",
      },
      {
        id: "m6",
        direction: "in",
        text: "Добре, чекаю на оновлений розрахунок з іншим матеріалом.",
        createdAt: "2026-03-16T14:10:00.000Z",
      },
    ],
  },
  {
    id: "c4",
    customerName: "Новий звернення · без звʼязку",
    customerHandle: "@unknown_client",
    channel: "telegram",
    lastMessagePreview: "Доброго дня, цікавить кухня на замовлення.",
    lastMessageAt: "Щойно",
    unreadCount: 1,
    hasUnanswered: true,
    slaState: "ok",
    status: "open",
    assignee: "Марина",
    linkedEntityType: "none",
    messages: [
      {
        id: "m7",
        direction: "in",
        text: "Доброго дня, цікавить кухня на замовлення.",
        createdAt: "2026-03-20T08:00:00.000Z",
      },
    ],
  },
];

export type InboxShellProps = {
  /** Відповідає підмаршруту /inbox/... */
  initialTab?: InboxFilterTab;
  /** Наприклад, лише Telegram для /inbox/telegram */
  channelFilter?: InboxChannel | null;
};

export function InboxShell({
  initialTab = "all",
  channelFilter = null,
}: InboxShellProps = {}) {
  const { data: session } = useSession();
  const [leadConversations, setLeadConversations] = useState<InboxConversation[]>(
    [],
  );
  const [unlinkedFeed, setUnlinkedFeed] = useState<InboxConversation[]>([]);
  const [activeTab, setActiveTab] =
    useState<InboxFilterTab>(initialTab);
  const [selectedId, setSelectedId] = useState<string | null>(
    demoConversations[0]?.id ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/inbox/conversations?limit=160&perLead=50");
        const j = (await r.json()) as { items?: InboxConversation[] };
        if (!r.ok || cancelled) return;
        setLeadConversations(j.items ?? []);
      } catch {
        // ignore, keep fallback demo feed
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/inbox/unlinked?limit=40");
        const j = (await r.json()) as {
          items?: Array<{
            id: string;
            channel: "telegram" | "whatsapp" | "viber";
            text: string;
            from: string;
            ownerUserId?: string | null;
            receivedAt: string;
          }>;
        };
        if (!r.ok || cancelled) return;
        const mapped: InboxConversation[] = (j.items ?? []).map((x) => ({
          id: `unlinked-${x.id}`,
          customerName: "Непривʼязаний діалог",
          customerHandle: x.from,
          channel: x.channel,
          lastMessagePreview: x.text,
          lastMessageAt: x.receivedAt,
          unreadCount: 1,
          hasUnanswered: true,
          slaState: "warning",
          status: "open",
          linkedEntityType: "none",
          linkedEntityLabel: undefined,
          messages: [
            {
              id: `${x.id}-m1`,
              direction: "in",
              text: x.text,
              createdAt: x.receivedAt,
            },
          ],
        }));
        setUnlinkedFeed(mapped);
      } catch {
        // ignore network errors for optional unlinked feed
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const conversations = useMemo(() => {
    const base = [
      ...unlinkedFeed,
      ...(leadConversations.length > 0 ? leadConversations : demoConversations),
    ];
    return base
      .filter((conv) => {
        if (channelFilter && conv.channel !== channelFilter) {
          return false;
        }
        return true;
      })
      .filter((conv) => {
        if (activeTab === "unread") {
          return conv.unreadCount > 0;
        }
        if (activeTab === "unanswered") {
          return conv.hasUnanswered;
        }
        if (activeTab === "overdue") {
          return conv.slaState === "overdue";
        }
        if (activeTab === "mine") {
          const myName = session?.user?.name?.trim();
          if (!myName) return false;
          return conv.assignee?.trim() === myName;
        }
        if (activeTab === "unlinked") {
          return (
            conv.linkedEntityType === "none" ||
            !conv.linkedEntityLabel
          );
        }
        return true;
      });
  }, [activeTab, channelFilter, unlinkedFeed, leadConversations, session?.user?.name]);

  const selectedConversation: InboxConversation | null =
    conversations.find((c) => c.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handleNewMessage = (text: string) => {
    if (!selectedConversation) return;
    // В демо просто додаємо повідомлення в памʼяті
    selectedConversation.messages.push({
      id: `local-${Date.now()}`,
      direction: "out",
      text,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)] bg-slate-50">
      <section className="flex w-80 flex-col border-r border-slate-200 bg-[var(--enver-card)]/95 px-3 py-3 text-xs">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
              Вхідні
            </p>
            <p className="text-xs text-slate-600">
              Всі звернення клієнтів в одному місці.
            </p>
          </div>
        </div>

        <div className="mb-2">
          <input
            type="text"
            placeholder="Пошук по клієнту або тексту…"
            className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-[var(--enver-card)]"
          />
        </div>

        <ConversationFilters
          activeTab={activeTab}
          onChangeTab={setActiveTab}
        />

        <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-[11px] text-slate-500">
              Вхідні поки порожні. Після підключення Telegram-бота
              тут будуть зʼявлятися звернення клієнтів.
            </div>
          ) : (
            conversations.map((conv) => (
              <ConversationListItem
                key={conv.id}
                item={conv}
                active={conv.id === selectedId}
                onSelect={() => handleSelect(conv.id)}
              />
            ))
          )}
        </div>
      </section>

      <ConversationView
        conversation={selectedConversation}
        onNewMessage={handleNewMessage}
      />

      <ConversationSidebar conversation={selectedConversation} />
    </div>
  );
}

