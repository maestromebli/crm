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
    clientType: z.enum(["PERSON", "COMPANY"]).nullable().optional(),
    clientName: z.string().max(300).nullable().optional(),
    unlinkClient: z.boolean().optional(),
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
    select: {
      id: true,
      clientId: true,
      client: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
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
    const updated = await prisma.$transaction(async (tx) => {
      let nextClientId: string | null | undefined = undefined;

      if (patch.unlinkClient) {
        nextClientId = null;
      } else if (patch.clientName !== undefined || patch.clientType !== undefined) {
        const nextType = patch.clientType ?? exists.client?.type ?? "COMPANY";
        const nextNameRaw = patch.clientName ?? exists.client?.name ?? null;
        const nextName = nextNameRaw?.trim() || null;

        if (!nextName) {
          nextClientId = null;
        } else if (exists.clientId && exists.client && exists.client.type === nextType) {
          await tx.client.update({
            where: { id: exists.clientId },
            data: { name: nextName, type: nextType },
          });
          nextClientId = exists.clientId;
        } else {
          const client = await tx.client.create({
            data: {
              name: nextName,
              type: nextType,
            },
            select: { id: true },
          });
          nextClientId = client.id;
        }
      }

      return tx.contact.update({
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
          ...(patch.category !== undefined && { category: patch.category }),
          ...(nextClientId !== undefined && { clientId: nextClientId }),
        },
      });
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
        category: updated.category,
        clientId: updated.clientId,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
     
    console.error("[PATCH /api/contacts/[contactId]]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
