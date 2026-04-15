import { NextResponse } from "next/server";
import { z } from "zod";
import { forbidUnlessPermission, requireSessionUser } from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { recordContinuousLearningEvent } from "../../../../../lib/ai/continuous-learning";

export const runtime = "nodejs";

const bodySchema = z.object({
  note: z.string().min(10).max(6000),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export async function POST(request: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні дані", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const note = parsed.data.note.trim();
  if (!note) {
    return NextResponse.json({ error: "Порожня нотатка" }, { status: 400 });
  }

  await recordContinuousLearningEvent({
    userId: user.id,
    action: "settings_admin_knowledge",
    stage: "settings_admin_knowledge",
    entityType: "SYSTEM",
    entityId: "global",
    ok: true,
    metadata: {
      note,
      tags: parsed.data.tags ?? [],
      savedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true });
}
