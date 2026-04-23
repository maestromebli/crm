import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { applyTemplateChangeProposal } from "@/lib/ai/template-change-workflow";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
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

  try {
    const result = await applyTemplateChangeProposal(user, proposalId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    const status =
      msg === "PROPOSAL_NOT_FOUND"
        ? 404
        : msg === "APPROVER_ROLE_REQUIRED"
          ? 403
          : 400;
    return NextResponse.json(
      { error: "Не вдалося застосувати зміну шаблону", detail: msg },
      { status },
    );
  }
}
