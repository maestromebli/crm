import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

const TYPE_UA: Record<string, string> = {
  DEAL_CREATED: "Угода створена",
  DEAL_UPDATED: "Угода оновлена",
  DEAL_STAGE_CHANGED: "Зміна стадії",
  DEAL_WORKSPACE_META_UPDATED: "Оновлено дані воркспейсу",
  CONTRACT_CREATED: "Створено договір",
  CONTRACT_STATUS_CHANGED: "Зміна статусу договору",
  FILE_UPLOADED: "Додано файл",
  HANDOFF_SUBMITTED: "Передачу відправлено",
  HANDOFF_ACCEPTED: "Передачу прийнято",
  HANDOFF_REJECTED: "Передачу відхилено",
  PRODUCTION_LAUNCH_QUEUED: "Постановка запуску у чергу",
  PRODUCTION_LAUNCHED: "Запуск у виробництво",
  PRODUCTION_LAUNCH_FAILED: "Збій запуску у виробництво",
  PRODUCTION_LAUNCH_RETRIED: "Повторна постановка запуску в чергу",
  READINESS_SNAPSHOT_SAVED: "Збережено знімок готовності",
  CONSTRUCTOR_ROOM_CREATED: "Створено кімнату конструктора",
  CONSTRUCTOR_ROOM_SENT: "Завдання надіслано конструктору",
  CONSTRUCTOR_ROOM_FILE_DELIVERED: "Конструктор здав файл",
  CONSTRUCTOR_ROOM_REVIEWED: "Конструктор: перевірено офісом",
  FINANCE_INVOICE_CREATED: "Створено рахунок на оплату",
  FINANCE_INVOICE_UPDATED: "Оновлено рахунок",
  CLIENT_PAYMENT_RECORDED: "Зареєстровано оплату від клієнта",
  CLIENT_PAYMENT_VOIDED: "Скасовано запис оплати",
  DEAL_FINANCE_SNAPSHOT_SAVED: "Збережено фінансовий знімок угоди",
};

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
    if (denied) return denied;

    const rows = await prisma.activityLog.findMany({
      where: { entityType: "DEAL", entityId: dealId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        source: true,
        data: true,
        createdAt: true,
        actorUser: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        label: TYPE_UA[r.type] ?? r.type,
        source: r.source,
        data: r.data,
        createdAt: r.createdAt.toISOString(),
        actor: r.actorUser
          ? r.actorUser.name ?? r.actorUser.email
          : null,
      })),
    });
  } catch (e) {
     
    console.error("[GET deal activity]", e);
    return NextResponse.json({ error: "Помилка завантаження" }, { status: 500 });
  }
}
