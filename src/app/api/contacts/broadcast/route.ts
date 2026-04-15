import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { getEffectiveCommunicationsConfigForUser } from "../../../../lib/settings/communications-settings-store";
import { externalPostJson } from "../../../../lib/api/external-json";

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = digitsOnly(phone);
  if (!digits) return null;
  if (digits.startsWith("380")) return `+${digits}`;
  if (digits.length === 10) return `+38${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+38${digits.slice(1)}`;
  return `+${digits}`;
}

const bodySchema = z
  .object({
    channel: z.enum(["telegram", "whatsapp"]),
    message: z.string().min(1).max(5000),
    contactIds: z.array(z.string().min(1)).max(1000).optional(),
    category: z
      .enum([
        "DESIGNER",
        "CONSTRUCTION_COMPANY",
        "MANAGER",
        "DESIGN_STUDIO",
        "END_CUSTOMER",
        "ARCHITECT",
        "SUPPLIER",
        "OTHER",
      ])
      .optional(),
    toAll: z.boolean().optional(),
  })
  .strict();

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.LEADS_UPDATE);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні параметри", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const where = payload.toAll
    ? {
        ...(payload.category ? { category: payload.category } : {}),
      }
    : {
        id: { in: payload.contactIds ?? [] },
      };

  const contacts = await prisma.contact.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      phone: true,
      telegramHandle: true,
    },
    take: 1000,
  });
  if (!contacts.length) {
    return NextResponse.json({ error: "Контакти не знайдено" }, { status: 404 });
  }

  const cfg = await getEffectiveCommunicationsConfigForUser(user.id);
  const text = payload.message.trim();
  let sent = 0;
  let failed = 0;
  const failedItems: Array<{ id: string; fullName: string; reason: string }> = [];

  if (payload.channel === "telegram") {
    const tg = cfg.channels?.telegram;
    const token = tg?.botToken?.trim();
    if (!tg?.enabled || !token) {
      return NextResponse.json(
        { error: "Telegram не налаштований у комунікаціях" },
        { status: 400 },
      );
    }
    for (const c of contacts) {
      const chatId = (c.telegramHandle?.trim() || tg.channelId?.trim() || "").replace(
        /^([^@])/,
        "@$1",
      );
      if (!chatId) {
        failed += 1;
        failedItems.push({
          id: c.id,
          fullName: c.fullName,
          reason: "telegram_handle_missing",
        });
        continue;
      }
      const res = await externalPostJson<{ ok?: boolean }>(
        `https://api.telegram.org/bot${token}/sendMessage`,
        { chat_id: chatId, text },
      );
      if (res.ok && res.data?.ok) {
        sent += 1;
      } else {
        failed += 1;
        failedItems.push({ id: c.id, fullName: c.fullName, reason: "telegram_send_failed" });
      }
    }
  } else {
    const wa = cfg.channels?.whatsapp;
    const token = wa?.accessToken?.trim();
    const phoneNumberId = wa?.phoneNumberId?.trim();
    if (!wa?.enabled || !token || !phoneNumberId) {
      return NextResponse.json(
        { error: "WhatsApp не налаштований у комунікаціях" },
        { status: 400 },
      );
    }
    const apiBase = (wa.cloudApiUrl?.trim() || "https://graph.facebook.com/v20.0").replace(
      /\/$/,
      "",
    );
    for (const c of contacts) {
      const to = normalizePhone(c.phone);
      if (!to) {
        failed += 1;
        failedItems.push({ id: c.id, fullName: c.fullName, reason: "whatsapp_phone_missing" });
        continue;
      }
      const res = await externalPostJson<{ messages?: Array<{ id?: string }> }>(
        `${apiBase}/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (res.ok) {
        sent += 1;
      } else {
        failed += 1;
        failedItems.push({ id: c.id, fullName: c.fullName, reason: "whatsapp_send_failed" });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    channel: payload.channel,
    total: contacts.length,
    sent,
    failed,
    failedItems: failedItems.slice(0, 50),
  });
}

