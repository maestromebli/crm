import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../../../lib/authz/permissions";
import { getSupplierItemsByIds } from "../../../../../features/suppliers/services/supplierSearchService";

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const permCtx = { realRole: user.realRole, impersonatorId: user.impersonatorId };
  const ok =
    hasEffectivePermission(user.permissionKeys, P.LEADS_VIEW, permCtx) ||
    hasEffectivePermission(user.permissionKeys, P.ESTIMATES_VIEW, permCtx);
  if (!ok) return forbidUnlessPermission(user, P.LEADS_VIEW);

  const { searchParams } = new URL(req.url);
  const idsRaw = searchParams.get("ids") ?? "";
  const ids = idsRaw.split(",").map((x) => x.trim()).filter(Boolean);
  const items = await getSupplierItemsByIds(ids);
  return NextResponse.json({ items });
}
