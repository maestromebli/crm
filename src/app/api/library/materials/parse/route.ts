import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { extractRowsFromSheet } from "../../../../../lib/materials/price-import-excel";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передано" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(bytes, { type: "buffer" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    return NextResponse.json({ error: "Порожній Excel" }, { status: 400 });
  }

  const sheet = wb.Sheets[firstSheetName];
  const rows = extractRowsFromSheet(sheet);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Не знайдено валідних рядків у прайсі" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    fileName: file.name,
    rowCount: rows.length,
    rows,
  });
}
