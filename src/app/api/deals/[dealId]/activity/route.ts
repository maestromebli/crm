import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import {
  canonicalEventType,
  EVENT_FAMILIES,
  eventFamilyForType,
} from "../../../../../lib/events/event-catalog";

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
  payment_received: "Отримано оплату",
  status_changed: "Змінено статус",
  file_uploaded: "Завантажено файл",
  estimate_created: "Створено прорахунок",
  quote_sent: "Надіслано КП",
};

export async function GET(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  const category = new URL(req.url).searchParams.get("category");

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
    const eventRows = await prisma.domainEvent.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        payload: true,
        createdAt: true,
      },
    });
    const eventItems = eventRows.map((r) => ({
      id: `ev_${r.id}`,
      type: r.type,
      label: TYPE_UA[canonicalEventType(r.type)] ?? TYPE_UA[r.type] ?? r.type,
      category: eventFamilyForType(r.type),
      source: "domain_event",
      data: r.payload,
      createdAt: r.createdAt.toISOString(),
      actor: null as string | null,
    }));
    const activityItems = rows.map((r) => ({
      id: r.id,
      type: r.type,
      label: TYPE_UA[r.type] ?? r.type,
      category: EVENT_FAMILIES.DEAL,
      source: r.source,
      data: r.data,
      createdAt: r.createdAt.toISOString(),
      actor: r.actorUser
        ? r.actorUser.name ?? r.actorUser.email
        : null,
    }));
    const items = [...activityItems, ...eventItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const isKnownCategory =
      category === EVENT_FAMILIES.LEAD ||
      category === EVENT_FAMILIES.DEAL ||
      category === EVENT_FAMILIES.PRODUCTION ||
      category === EVENT_FAMILIES.AI_AUTOMATION;
    const filtered =
      category && isKnownCategory ? items.filter((x) => x.category === category) : items;

    return NextResponse.json({
      items: filtered.slice(0, 60),
    });
  } catch (e) {
     
    console.error("[GET deal activity]", e);
    return NextResponse.json({ error: "Помилка завантаження" }, { status: 500 });
  }
}
