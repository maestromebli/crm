import type { DealWorkspacePayload } from "@/lib/deal-core/workspace-types";

export type WorkspaceConstructorRoom = NonNullable<
  DealWorkspacePayload["constructorRoom"]
>;

/** Той самий select, що й у GET/PATCH `/api/deals/.../constructor-room`. */
export function dealConstructorRoomApiSelect() {
  return {
    id: true,
    dealId: true,
    status: true,
    publicToken: true,
    assignedById: true,
    assignedUserId: true,
    externalConstructorLabel: true,
    telegramInviteUrl: true,
    telegramChatId: true,
    aiQaJson: true,
    priority: true,
    dueAt: true,
    sentToConstructorAt: true,
    deliveredAt: true,
    reviewedAt: true,
    createdAt: true,
    updatedAt: true,
    assignedBy: { select: { id: true, name: true, email: true } },
    assignedUser: { select: { id: true, name: true, email: true } },
    messages: {
      orderBy: { createdAt: "asc" as const },
      take: 200,
      select: {
        id: true,
        body: true,
        author: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    },
  };
}

type PrismaRoomRow = {
  id: string;
  status: WorkspaceConstructorRoom["status"];
  publicToken: string;
  externalConstructorLabel: string | null;
  telegramInviteUrl: string | null;
  telegramChatId: string | null;
  aiQaJson: unknown | null;
  priority: WorkspaceConstructorRoom["priority"];
  dueAt: Date | null;
  sentToConstructorAt: Date | null;
  deliveredAt: Date | null;
  reviewedAt: Date | null;
  assignedUserId: string | null;
  assignedUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  messages: Array<{
    id: string;
    body: string;
    author: "INTERNAL" | "CONSTRUCTOR";
    createdAt: Date;
    createdBy: { name: string | null; email: string } | null;
  }>;
};

/** Узгоджено з `getDealWorkspacePayload` (порядок повідомлень: від старих до нових). */
export function mapPrismaConstructorRoomToWorkspacePayload(
  cr: PrismaRoomRow,
): WorkspaceConstructorRoom {
  return {
    id: cr.id,
    status: cr.status,
    publicToken: cr.publicToken,
    externalConstructorLabel: cr.externalConstructorLabel,
    telegramInviteUrl: cr.telegramInviteUrl,
    telegramChatId: cr.telegramChatId,
    aiQaJson: cr.aiQaJson,
    priority: cr.priority,
    dueAt: cr.dueAt?.toISOString() ?? null,
    sentToConstructorAt: cr.sentToConstructorAt?.toISOString() ?? null,
    deliveredAt: cr.deliveredAt?.toISOString() ?? null,
    reviewedAt: cr.reviewedAt?.toISOString() ?? null,
    assignedUserId: cr.assignedUserId,
    assignedUser: cr.assignedUser
      ? {
          id: cr.assignedUser.id,
          name: cr.assignedUser.name,
          email: cr.assignedUser.email,
        }
      : null,
    messages: cr.messages.map((m) => ({
      id: m.id,
      body: m.body,
      author: m.author,
      createdAt: m.createdAt.toISOString(),
      authorLabel:
        m.author === "INTERNAL"
          ? (m.createdBy?.name?.trim() ||
              m.createdBy?.email ||
              "Команда")
          : "Конструктор",
    })),
  };
}
