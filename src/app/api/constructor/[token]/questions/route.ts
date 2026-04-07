import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { addFlowQuestion } from "@/features/production/server/services/production-flow.service";

type Ctx = { params: Promise<{ token: string }> };

const schema = z.object({
  text: z.string().min(2),
});

export async function POST(request: Request, context: Ctx) {
  const { token } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректний текст питання" }, { status: 400 });
  }

  const tokenPath = `/constructor/${token}`;
  const flow = await prisma.productionFlow.findFirst({
    where: { constructorWorkspaceUrl: { contains: tokenPath } },
    select: { id: true, constructorName: true },
  });
  if (!flow) return NextResponse.json({ error: "Робоче місце не знайдено" }, { status: 404 });

  await addFlowQuestion(flow.id, {
    actorName: flow.constructorName ?? "Constructor",
    source: "TELEGRAM_PLACEHOLDER",
    text: parsed.data.text,
  });

  return NextResponse.json({ ok: true });
}
