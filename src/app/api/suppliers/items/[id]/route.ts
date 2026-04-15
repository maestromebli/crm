import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../../../lib/authz/permissions";
import { getSupplierItemById } from "../../../../../features/suppliers/services/supplierSearchService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const permCtx = { realRole: user.realRole, impersonatorId: user.impersonatorId };
  const ok =
    hasEffectivePermission(user.permissionKeys, P.LEADS_VIEW, permCtx) ||
    hasEffectivePermission(user.permissionKeys, P.ESTIMATES_VIEW, permCtx);
  if (!ok) return forbidUnlessPermission(user, P.LEADS_VIEW);

  const { id } = await ctx.params;
  const item = await getSupplierItemById(id);
  return NextResponse.json({ item });
}
