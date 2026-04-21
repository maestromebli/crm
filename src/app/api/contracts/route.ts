import { NextRequest, NextResponse } from "next/server";
import { createContractSchema } from "@/features/contracts/schemas/contract.schema";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { createContractFromTemplate } from "@/features/contracts/services/create-contract-from-template";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_VIEW);
  if (denied) return denied;

  const orderId = req.nextUrl.searchParams.get("orderId");
  const dealId = req.nextUrl.searchParams.get("dealId");
  const where = {
    ...(orderId ? { orderId } : {}),
    ...(dealId ? { dealId } : {}),
  };
  const rows = await prisma.enverContract.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { parties: true, sessions: { orderBy: { createdAt: "desc" }, take: 1 } },
    take: 50,
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_CREATE);
  if (denied) return denied;

  const body = await req.json();
  const parsed = createContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const contract = await createContractFromTemplate({
      prisma,
      orderId: parsed.data.orderId,
      templateCode: parsed.data.templateCode,
    });
    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "FAILED_TO_CREATE_CONTRACT" },
      { status: 400 },
    );
  }
}
