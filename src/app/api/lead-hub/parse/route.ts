import { NextResponse } from "next/server";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

/**
 * @deprecated Legacy parser mock endpoint.
 * Compatibility only; production parsing should use canonical estimate import flows.
 */
export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.AI_USE);
  if (denied) return denied;

  const body = (await req.json()) as {
    type?: "image" | "excel" | "pdf";
    fileName?: string;
  };

  const type = body.type ?? "image";

  // DUPLICATE PRICING - TO BE REFACTORED
  const presets = {
    image: {
      items: [
        {
          id: crypto.randomUUID(),
          name: "Image parsed module",
          quantity: 1,
          unitCost: 1700,
          unitPrice: 2500,
        },
      ],
      meta: { source: "image", fileName: body.fileName ?? "unknown" },
    },
    excel: {
      items: [
        {
          id: crypto.randomUUID(),
          name: "Excel parsed module",
          quantity: 2,
          unitCost: 1000,
          unitPrice: 1700,
        },
      ],
      meta: { source: "excel", fileName: body.fileName ?? "unknown" },
    },
    pdf: {
      items: [
        {
          id: crypto.randomUUID(),
          name: "PDF parsed module",
          quantity: 1,
          unitCost: 1400,
          unitPrice: 2200,
        },
      ],
      meta: { source: "pdf", fileName: body.fileName ?? "unknown" },
    },
  } as const;

  return NextResponse.json(presets[type]);
}
