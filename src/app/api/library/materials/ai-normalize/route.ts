import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import {
  enrichPriceRowsWithAi,
  heuristicEnrichRows,
} from "../../../../../lib/materials/price-import-ai";
import type { PriceImportRowNorm } from "../../../../../lib/materials/price-import-excel";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  let body: { rows?: PriceImportRowNorm[]; skipAi?: boolean };
  try {
    body = (await req.json()) as { rows?: PriceImportRowNorm[]; skipAi?: boolean };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "Немає рядків" }, { status: 400 });
  }

  if (rows.length > 5000) {
    return NextResponse.json(
      { error: "Занадто багато рядків (макс. 5000 за один прохід)" },
      { status: 400 },
    );
  }

  if (body.skipAi === true) {
    const enriched = heuristicEnrichRows(rows);
    return NextResponse.json({
      ok: true,
      enriched,
      usedAi: false,
      aiError: null,
    });
  }

  const result = await enrichPriceRowsWithAi(rows);

  return NextResponse.json({
    ok: true,
    enriched: result.rows,
    usedAi: result.usedAi,
    aiError: result.aiError ?? null,
  });
}
