import { NextResponse } from "next/server";
import { publishTemplateVersion } from "@/features/contracts/services/publish-template-version";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const { id } = await params;
  try {
    const result = await publishTemplateVersion({ prisma, templateId: id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PUBLISH_FAILED" },
      { status: 400 },
    );
  }
}
