import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { ownerIdWhere, resolveAccessContext } from "../../../../lib/authz/data-scope";

type Ctx = { params: Promise<{ contactId: string }> };

const patchSchema = z
  .object({
    fullName: z.string().min(1).max(300).optional(),
    firstName: z.string().max(120).nullable().optional(),
    lastName: z.string().max(120).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    email: z
      .union([z.string().email().max(320), z.literal(""), z.null()])
      .optional(),
    instagramHandle: z.string().max(120).nullable().optional(),
    telegramHandle: z.string().max(120).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    country: z.string().max(120).nullable().optional(),
    notes: z.string().max(20_000).nullable().optional(),
  })
  .strict();

export async function PATCH(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.LEADS_UPDATE);
  if (denied) return denied;
  const access = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  const ownerWhere = ownerIdWhere(access);

  const { contactId } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні поля", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Немає полів для оновлення" }, {
      status: 400,
    });
  }

  const exists = await prisma.contact.findFirst({
    where: {
      id: contactId,
      ...(ownerWhere
        ? {
            OR: [
              { leads: { some: { ownerId: ownerWhere } } },
              { deals: { some: { ownerId: ownerWhere } } },
            ],
          }
        : {}),
    },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Контакт не знайдено" }, { status: 404 });
  }

  const emailOut =
    patch.email === undefined
      ? undefined
      : patch.email === ""
        ? null
        : patch.email;

  try {
    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(patch.fullName !== undefined && { fullName: patch.fullName }),
        ...(patch.firstName !== undefined && { firstName: patch.firstName }),
        ...(patch.lastName !== undefined && { lastName: patch.lastName }),
        ...(patch.phone !== undefined && { phone: patch.phone }),
        ...(emailOut !== undefined && { email: emailOut }),
        ...(patch.instagramHandle !== undefined && {
          instagramHandle: patch.instagramHandle,
        }),
        ...(patch.telegramHandle !== undefined && {
          telegramHandle: patch.telegramHandle,
        }),
        ...(patch.city !== undefined && { city: patch.city }),
        ...(patch.country !== undefined && { country: patch.country }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
      },
    });
    return NextResponse.json({
      ok: true,
      contact: {
        id: updated.id,
        fullName: updated.fullName,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        email: updated.email,
        instagramHandle: updated.instagramHandle,
        telegramHandle: updated.telegramHandle,
        city: updated.city,
        country: updated.country,
        notes: updated.notes,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
     
    console.error("[PATCH /api/contacts/[contactId]]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
