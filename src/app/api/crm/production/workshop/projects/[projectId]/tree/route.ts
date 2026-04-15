import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/authz/api-guard";
import {
  canManageProduction,
  canViewProduction,
} from "@/features/production/server/permissions/production-permissions";
import { MINI_HQ_STAGE_KEYS } from "@/features/production/workshop-mini-hq";
import {
  getProjectTree,
  setProjectTree,
} from "@/features/production/server/services/workshop-mini-hq.service";

type Ctx = { params: Promise<{ projectId: string }> };

const nodeSchema = z.object({
  id: z.string().min(1).max(120),
  parentId: z.string().min(1).max(120).nullable(),
  type: z.enum(["folder", "file"]),
  name: z.string().min(1).max(220),
  stageKey: z.enum(MINI_HQ_STAGE_KEYS).nullable(),
  gitlabProjectId: z.string().max(120).nullable(),
  gitlabRef: z.string().max(120).nullable(),
  gitlabPath: z.string().max(400).nullable(),
  gitlabWebUrl: z.string().max(1000).nullable(),
});

const bodySchema = z.object({
  nodes: z.array(nodeSchema).max(1000),
});

export async function GET(_request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  const { projectId } = await context.params;
  try {
    const nodes = await getProjectTree(projectId);
    return NextResponse.json({ nodes });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Проєкт не знайдено" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не вдалося завантажити дерево" }, { status: 500 });
  }
}

export async function POST(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canManageProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав для зміни дерева" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректна структура дерева" }, { status: 400 });
  }
  const { projectId } = await context.params;
  try {
    const nodes = parsed.data.nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId ?? null,
      type: node.type,
      name: node.name,
      stageKey: node.stageKey ?? null,
      gitlabProjectId: node.gitlabProjectId ?? null,
      gitlabRef: node.gitlabRef ?? null,
      gitlabPath: node.gitlabPath ?? null,
      gitlabWebUrl: node.gitlabWebUrl ?? null,
    }));
    await setProjectTree({ projectId, nodes });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Проєкт не знайдено" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не вдалося зберегти дерево" }, { status: 500 });
  }
}

