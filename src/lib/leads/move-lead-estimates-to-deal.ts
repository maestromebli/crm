import type { Prisma } from "@prisma/client";
import { prismaCodegenIncludesEstimateLeadId } from "../prisma";

export type MoveLeadEstimatesOptions = {
  /** Якщо false — смети не переносяться (знімок вимкнено). */
  enabled: boolean;
  /** Якщо true — переносяться й DRAFT; інакше лише не-чернетки. */
  includeDrafts: boolean;
};

/**
 * Після конверсії ліда в замовлення: переносить смети з leadId на dealId з новими номерами версій.
 */
export async function moveLeadEstimatesToDeal(
  tx: Prisma.TransactionClient,
  leadId: string,
  dealId: string,
  options?: MoveLeadEstimatesOptions,
): Promise<number> {
  if (!prismaCodegenIncludesEstimateLeadId()) {
    return 0;
  }

  const opts: MoveLeadEstimatesOptions = options ?? {
    enabled: true,
    includeDrafts: true,
  };
  if (!opts.enabled) {
    return 0;
  }

  const agg = await tx.estimate.aggregate({
    where: { dealId },
    _max: { version: true },
  });
  let nextVersion = (agg._max.version ?? 0) + 1;
  const rows = await tx.estimate.findMany({
    where: {
      leadId,
      ...(opts.includeDrafts ? {} : { status: { not: "DRAFT" } }),
    },
    orderBy: { version: "asc" },
    select: { id: true },
  });
  for (const r of rows) {
    await tx.estimate.update({
      where: { id: r.id },
      data: {
        dealId,
        leadId: null,
        version: nextVersion,
      },
    });
    nextVersion += 1;
  }
  return rows.length;
}
