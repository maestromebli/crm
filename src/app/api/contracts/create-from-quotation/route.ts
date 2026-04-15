import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { createContractFromQuotation, mapContractDetails } from "@/lib/contracts/service";
import { createFromQuotationSchema } from "@/lib/contracts/schemas";

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_CREATE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const parsed = createFromQuotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const contract = await createContractFromQuotation({
      prisma,
      dealId: parsed.data.dealId,
      quotationId: parsed.data.quotationId,
      userId: user.id,
      fields: parsed.data.fields,
    });
    const full = await prisma.dealContract.findUnique({ where: { id: contract.id } });
    if (!full) {
      return NextResponse.json({ error: "Контракт не знайдено" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: mapContractDetails(full) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      msg === "DEAL_NOT_FOUND" || msg === "QUOTATION_NOT_FOUND"
        ? 404
        : msg === "CONTRACT_ALREADY_EXISTS" || msg === "QUOTATION_DEAL_MISMATCH"
          ? 409
          : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
