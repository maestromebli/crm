import { NextResponse } from "next/server";
import { z } from "zod";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import {
  createTemplateChangeProposal,
  listTemplateChangeProposals,
} from "@/lib/ai/template-change-workflow";

const createSchema = z.object({
  title: z.string().min(5).max(200),
  templateKey: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9._-]+$/i),
  beforeTemplate: z.string().max(12_000).optional().default(""),
  afterTemplate: z.string().min(10).max(12_000),
  expectedImpact: z.string().min(5).max(1_500),
  rollbackPlan: z.string().min(5).max(1_500),
});

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const takeRaw = Number.parseInt(searchParams.get("take") ?? "", 10);
  const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(100, takeRaw)) : 40;
  try {
    const items = await listTemplateChangeProposals(take);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: "Не вдалося завантажити пропозиції", detail: (e as Error).message },
      { status: 500 },
    );
  }
}

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
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні дані", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await createTemplateChangeProposal(user, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Не вдалося створити пропозицію", detail: (e as Error).message },
      { status: 500 },
    );
  }
}
