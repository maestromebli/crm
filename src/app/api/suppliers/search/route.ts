import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../../lib/authz/permissions";
import { searchSupplierItems } from "../../../../features/suppliers/services/supplierSearchService";

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const ctx = { realRole: user.realRole, impersonatorId: user.impersonatorId };
  const ok =
    hasEffectivePermission(user.permissionKeys, P.LEADS_VIEW, ctx) ||
    hasEffectivePermission(user.permissionKeys, P.ESTIMATES_VIEW, ctx);
  if (!ok) return forbidUnlessPermission(user, P.LEADS_VIEW);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? "20") || 20;
  const suppliersRaw = searchParams.get("suppliers");
  const suppliers = suppliersRaw
    ? suppliersRaw
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter((x) => x === "VIYAR" || x === "CSV" || x === "MANUAL")
    : undefined;

  const result = await searchSupplierItems(q, {
    limit,
    suppliers: suppliers as ("VIYAR" | "CSV" | "MANUAL")[] | undefined,
  });
  return NextResponse.json(result);
}
