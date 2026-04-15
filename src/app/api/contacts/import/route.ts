import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { parseContactsImportFile } from "../../../../lib/contacts/import-contacts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.LEADS_UPDATE);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Некоректний multipart" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передано" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const rows = parseContactsImportFile(bytes);
  if (!rows.length) {
    return NextResponse.json(
      { error: "Не знайдено валідних рядків для імпорту" },
      { status: 400 },
    );
  }

  const companyCache = new Map<string, string>();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      let clientId: string | null = null;
      if (row.companyName) {
        const key = `${row.companyType}:${row.companyName.toLowerCase()}`;
        const cached = companyCache.get(key);
        if (cached) {
          clientId = cached;
        } else {
          const existing = await prisma.client.findFirst({
            where: {
              name: { equals: row.companyName, mode: "insensitive" },
              type: row.companyType,
            },
            select: { id: true },
          });
          const client =
            existing ??
            (await prisma.client.create({
              data: {
                name: row.companyName,
                type: row.companyType,
              },
              select: { id: true },
            }));
          clientId = client.id;
          companyCache.set(key, clientId);
        }
      }

      const byEmail =
        row.email &&
        (await prisma.contact.findFirst({
          where: { email: { equals: row.email, mode: "insensitive" } },
          select: { id: true },
        }));
      const byPhone =
        !byEmail &&
        row.phone &&
        (await prisma.contact.findFirst({
          where: { phone: row.phone },
          select: { id: true },
        }));

      const existingId = byEmail?.id ?? byPhone?.id ?? null;
      if (existingId) {
        await prisma.contact.update({
          where: { id: existingId },
          data: {
            fullName: row.fullName,
            phone: row.phone,
            email: row.email,
            city: row.city,
            country: row.country,
            category: row.category,
            ...(clientId ? { clientId } : {}),
          },
        });
        updated += 1;
      } else {
        await prisma.contact.create({
          data: {
            fullName: row.fullName,
            phone: row.phone,
            email: row.email,
            city: row.city,
            country: row.country,
            category: row.category,
            ...(clientId ? { clientId } : {}),
          },
        });
        created += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    fileName: file.name,
    total: rows.length,
    created,
    updated,
    skipped,
  });
}

