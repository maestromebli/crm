import { NextResponse } from "next/server";
import { z } from "zod";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { decideTemplateChangeProposal } from "@/lib/ai/template-change-workflow";

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(2000).optional(),
});

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const { proposalId } = await params;
  if (!proposalId?.trim()) {
    return NextResponse.json({ error: "proposalId обов'язковий" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні дані", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await decideTemplateChangeProposal(user, {
      proposalId,
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    const status =
      msg === "PROPOSAL_NOT_FOUND"
        ? 404
        : msg === "APPROVER_ROLE_REQUIRED"
          ? 403
          : 400;
    return NextResponse.json({ error: "Не вдалося виконати рішення", detail: msg }, { status });
  }
}
