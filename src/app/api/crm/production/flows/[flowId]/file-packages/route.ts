import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canViewProduction } from "@/features/production/server/permissions/production-permissions";
import { registerFilePackage } from "@/features/production/server/services/production-flow.service";

type Ctx = { params: Promise<{ flowId: string }> };

const fileSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
});

const schema = z.object({
  packageName: z.string().min(2),
  versionLabel: z.string().min(1),
  packageTypeTags: z.array(z.string()).min(1),
  note: z.string().optional().nullable(),
  files: z.array(fileSchema).min(1),
});

export async function POST(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const { flowId } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані пакета файлів" }, { status: 400 });
  }

  const pkg = await registerFilePackage(flowId, { ...parsed.data, actorName: user.id });
  return NextResponse.json({ ok: true, packageId: pkg.id });
}
