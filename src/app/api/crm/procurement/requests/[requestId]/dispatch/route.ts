import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { externalPostJson } from "@/lib/api/external-json";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canAccessOwner, resolveAccessContext } from "@/lib/authz/data-scope";
import { canProcurementAction } from "@/features/procurement/lib/permissions";
import { getEffectiveCommunicationsConfigForUser } from "@/lib/settings/communications-settings-store";

type Params = {
  params: Promise<{ requestId: string }>;
};

type Body = {
  channel?: "telegram" | "whatsapp" | "viber";
  target?: string | null;
  message?: string | null;
};

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("380")) return `+${digits}`;
  if (digits.length === 10) return `+38${digits}`;
  return `+${digits}`;
}

function itemCategoryLabel(itemType: string | null): string {
  if ((itemType ?? "").toLowerCase() === "project") return "Під замовлення";
  return "Складські/типові";
}

function buildAutoMessage(input: {
  requestNumber: string;
  dealTitle: string;
  supplierName: string;
  items: Array<{
    name: string | null;
    qtyPlanned: number | null;
    plannedPrice: unknown;
    supplierName: string;
    itemType: string | null;
  }>;
}): string {
  const groups = new Map<string, Array<(typeof input.items)[number]>>();
  for (const item of input.items) {
    const key = `${item.supplierName}__${itemCategoryLabel(item.itemType)}`;
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }

  const lines: string[] = [
    `Заявка: ${input.requestNumber}`,
    `Замовлення: ${input.dealTitle}`,
    `Постачальник: ${input.supplierName}`,
    "",
    "Розбивка по групах:",
  ];

  for (const [key, groupItems] of groups.entries()) {
    const [supplier, category] = key.split("__");
    lines.push(`• ${supplier} / ${category}`);
    for (const row of groupItems.slice(0, 20)) {
      const qty = n(row.qtyPlanned);
      const price = n(row.plannedPrice);
      lines.push(`  - ${row.name ?? "позиція"}: ${qty} × ${price} грн`);
    }
  }
  lines.push("", "Просимо підтвердити наявність, строк та фінальну ціну по кожній позиції.");
  return lines.join("\n");
}

async function sendTelegram(args: {
  token: string;
  chatId: string;
  text: string;
}): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
  const res = await externalPostJson<{ ok?: boolean; result?: { message_id?: number } }>(
    `https://api.telegram.org/bot${args.token}/sendMessage`,
    { chat_id: args.chatId, text: args.text },
  );
  if (!res.ok || !res.data?.ok) {
    return { ok: false, error: "telegram_send_failed" };
  }
  return {
    ok: true,
    providerMessageId: res.data.result?.message_id
      ? String(res.data.result.message_id)
      : undefined,
  };
}

async function sendWhatsApp(args: {
  token: string;
  phoneNumberId: string;
  to: string;
  text: string;
  cloudApiUrl?: string | null;
}): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
  const apiBase = (args.cloudApiUrl?.trim() || "https://graph.facebook.com/v20.0").replace(
    /\/$/,
    "",
  );
  const res = await externalPostJson<{ messages?: Array<{ id?: string }> }>(
    `${apiBase}/${args.phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to: args.to,
      type: "text",
      text: { body: args.text },
    },
    {
      headers: {
        Authorization: `Bearer ${args.token}`,
      },
    },
  );
  if (!res.ok) return { ok: false, error: "whatsapp_send_failed" };
  return { ok: true, providerMessageId: res.data?.messages?.[0]?.id };
}

async function sendViber(args: {
  token: string;
  receiver: string;
  text: string;
}): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
  const res = await externalPostJson<{ message_token?: number; status?: number }>(
    "https://chatapi.viber.com/pa/send_message",
    {
      receiver: args.receiver,
      type: "text",
      text: args.text,
    },
    {
      headers: {
        "X-Viber-Auth-Token": args.token,
      },
    },
  );
  if (!res.ok || (typeof res.data?.status === "number" && res.data.status !== 0)) {
    return { ok: false, error: "viber_send_failed" };
  }
  return {
    ok: true,
    providerMessageId: res.data?.message_token
      ? String(res.data.message_token)
      : undefined,
  };
}

export async function POST(req: Request, { params }: Params) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.order.create")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const { requestId } = await params;
    if (!requestId?.trim()) {
      return NextResponse.json({ error: "Не вказано ідентифікатор заявки" }, { status: 400 });
    }

    const body = (await req.json()) as Body;
    const channel = body.channel ?? "telegram";

    const request = await prisma.procurementRequest.findUnique({
      where: { id: requestId },
      include: {
        deal: { select: { ownerId: true, title: true } },
        items: {
          select: { name: true, qtyPlanned: true, plannedPrice: true, itemType: true, supplierId: true },
        },
        supplier: { select: { name: true } },
      },
    });
    if (!request) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const access = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    if (!canAccessOwner(access, request.deal.ownerId)) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const cfg = await getEffectiveCommunicationsConfigForUser(request.deal.ownerId);
    const supplierName = request.supplier?.name ?? "Без постачальника";
    const itemSupplierIds = request.items
      .map((item) => item.supplierId ?? null)
      .filter((id): id is string => Boolean(id));
    const itemSupplierNameById =
      itemSupplierIds.length > 0
        ? Object.fromEntries(
            (
              await prisma.supplier.findMany({
                where: { id: { in: itemSupplierIds } },
                select: { id: true, name: true },
              })
            ).map((row) => [row.id, row.name]),
          )
        : {};
    const message =
      (body.message ?? "").trim() ||
      buildAutoMessage({
        requestNumber: request.number ?? request.id.slice(0, 8),
        dealTitle: request.deal.title,
        supplierName,
        items: request.items.map((item) => ({
          ...item,
          supplierName: itemSupplierNameById[item.supplierId ?? ""] ?? supplierName,
        })),
      });

    let providerMessageId: string | undefined;
    let target = (body.target ?? "").trim();

    if (channel === "telegram") {
      const token = cfg.channels?.telegram?.botToken?.trim();
      if (!token) {
        return NextResponse.json({ error: "Telegram не налаштовано (немає bot token)" }, { status: 422 });
      }
      if (!target) {
        target = (cfg.channels?.telegram?.channelId ?? "").trim();
      }
      if (!target) {
        return NextResponse.json({ error: "Вкажіть Telegram chat id" }, { status: 422 });
      }
      const tg = await sendTelegram({ token, chatId: target, text: message });
      if (!tg.ok) {
        return NextResponse.json({ error: "Не вдалося відправити повідомлення у Telegram" }, { status: 502 });
      }
      providerMessageId = tg.providerMessageId;
    } else if (channel === "whatsapp") {
      const wa = cfg.channels?.whatsapp;
      const token = wa?.accessToken?.trim();
      const phoneNumberId = wa?.phoneNumberId?.trim();
      if (!token || !phoneNumberId) {
        return NextResponse.json({ error: "WhatsApp не налаштовано (token/phoneNumberId)" }, { status: 422 });
      }
      const to = normalizePhone(target);
      if (!to) {
        return NextResponse.json({ error: "Вкажіть номер отримувача WhatsApp" }, { status: 422 });
      }
      const waRes = await sendWhatsApp({
        token,
        phoneNumberId,
        to,
        text: message,
        cloudApiUrl: wa?.cloudApiUrl ?? null,
      });
      if (!waRes.ok) {
        return NextResponse.json({ error: "Не вдалося відправити повідомлення у WhatsApp" }, { status: 502 });
      }
      providerMessageId = waRes.providerMessageId;
      target = to;
    } else {
      const token = cfg.channels?.viber?.authToken?.trim();
      if (!token) {
        return NextResponse.json({ error: "Viber не налаштовано (немає auth token)" }, { status: 422 });
      }
      if (!target) {
        return NextResponse.json({ error: "Вкажіть receiver id для Viber" }, { status: 422 });
      }
      const vb = await sendViber({ token, receiver: target, text: message });
      if (!vb.ok) {
        return NextResponse.json({ error: "Не вдалося відправити повідомлення у Viber" }, { status: 502 });
      }
      providerMessageId = vb.providerMessageId;
    }

    await prisma.procurementRequestStatusHistory.create({
      data: {
        requestId,
        fromStatus: request.workflowStatus ?? "new_request",
        toStatus: request.workflowStatus ?? "new_request",
        actorId: user.id,
        actorRole: user.realRole,
        reason: "Надіслано пакет постачальнику у месенджері",
        payload: {
          channel,
          target,
          providerMessageId: providerMessageId ?? null,
          autoGenerated: !(body.message ?? "").trim(),
        },
      },
    });

    return NextResponse.json({
      ok: true,
      channel,
      target,
      generatedMessage: message,
      providerMessageId: providerMessageId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/requests/[requestId]/dispatch]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
