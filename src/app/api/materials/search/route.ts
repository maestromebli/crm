import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../../lib/authz/permissions";
import { searchMaterials } from "../../../../lib/materials/material-provider";

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const ctx = { realRole: user.realRole, impersonatorId: user.impersonatorId };
  const ok =
    hasEffectivePermission(user.permissionKeys, P.LEADS_VIEW, ctx) ||
    hasEffectivePermission(user.permissionKeys, P.ESTIMATES_VIEW, ctx);
  if (!ok) {
    return forbidUnlessPermission(user, P.LEADS_VIEW);
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? "12") || 12;
  const providerRaw = searchParams.get("provider")?.trim().toUpperCase();
  const provider =
    providerRaw === "VIYAR" || providerRaw === "OTHER"
      ? providerRaw
      : undefined;

  const result = await searchMaterials(q, { limit, provider });
  return NextResponse.json(result);
}
