import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { ownerIdWhere, resolveAccessContext } from "../../../../../lib/authz/data-scope";

type Ctx = { params: Promise<{ contactId: string }> };

const createSchema = z
  .object({
    fullName: z.string().min(1).max(300),
    phone: z.string().max(40).nullable().optional(),
    email: z
      .union([z.string().email().max(320), z.literal(""), z.null()])
      .optional(),
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
  })
  .strict();

export async function POST(req: Request, ctx: Ctx) {
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

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні поля", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const base = await prisma.contact.findFirst({
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
      client: { select: { type: true } },
      city: true,
      country: true,
    },
  });
  if (!base) {
    return NextResponse.json({ error: "Контакт не знайдено" }, { status: 404 });
  }
  if (!base.clientId || base.client?.type !== "COMPANY") {
    return NextResponse.json(
      { error: "Основний контакт не привʼязаний до компанії" },
      { status: 400 },
    );
  }

  const email =
    parsed.data.email === undefined
      ? null
      : parsed.data.email === ""
        ? null
        : parsed.data.email;

  try {
    const created = await prisma.contact.create({
      data: {
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone?.trim() || null,
        email,
        category: parsed.data.category ?? "OTHER",
        clientId: base.clientId,
        city: base.city,
        country: base.country,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        category: true,
      },
    });

    return NextResponse.json({ ok: true, contact: created });
  } catch (e) {
    console.error("[POST /api/contacts/[contactId]/company-contacts]", e);
    return NextResponse.json(
      { error: "Не вдалося додати контакт компанії" },
      { status: 500 },
    );
  }
}

