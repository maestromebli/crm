import { Prisma, type PrismaClient } from "@prisma/client";
import { extractEnverExecutionSignals } from "./order-execution-policy";

type MetaShape = Record<string, unknown>;

function prismaHasDelegate(prisma: PrismaClient, name: string): boolean {
  const record = prisma as unknown as Record<string, unknown>;
  const delegate = record[name];
  return typeof delegate === "object" && delegate !== null;
}

function isMissingRelationError(error: unknown, relation: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022") &&
    error.message.includes(relation)
  );
}

export async function loadEnverExecutionSignals(args: {
  prisma: PrismaClient;
  dealId: string;
  meta: MetaShape;
}): Promise<{
  hasExecutionSpec: boolean;
  hasRequiredHandoffFiles: boolean;
  handoffChecklistCompleted: boolean;
  bomApproved: boolean;
  criticalMaterialsReady: boolean;
  deliveryAccepted: boolean;
  financeActualsPosted: boolean;
  productionDone: boolean;
}> {
  const base = extractEnverExecutionSignals(args.meta);

  const [spec, handoff] = await Promise.all([
    prismaHasDelegate(args.prisma, "projectSpec")
      ? args.prisma.projectSpec
          .findFirst({
            where: { dealId: args.dealId },
            select: {
              status: true,
              currentVersion: {
                select: {
                  id: true,
                  status: true,
                  approvalStage: true,
                  isExecutionBaseline: true,
                },
              },
            },
            orderBy: { updatedAt: "desc" },
          })
          .catch((error) => {
            if (isMissingRelationError(error, "ProjectSpec")) {
              return null;
            }
            throw error;
          })
      : Promise.resolve(null),
    args.prisma.dealHandoff.findUnique({
      where: { dealId: args.dealId },
      select: { id: true },
    }),
  ]);

  let handoffChecklistCompleted = base.handoffChecklistCompleted;
  if (handoff?.id) {
    const [requiredCount, requiredUnchecked] = await Promise.all([
      args.prisma.dealHandoffChecklistItem
        .count({
          where: { handoffId: handoff.id, isRequired: true },
        })
        .catch((error) => {
          if (isMissingRelationError(error, "DealHandoffChecklistItem")) {
            return 0;
          }
          throw error;
        }),
      args.prisma.dealHandoffChecklistItem
        .count({
          where: { handoffId: handoff.id, isRequired: true, isChecked: false },
        })
        .catch((error) => {
          if (isMissingRelationError(error, "DealHandoffChecklistItem")) {
            return 0;
          }
          throw error;
        }),
    ]);
    if (requiredCount > 0) {
      handoffChecklistCompleted = requiredUnchecked === 0;
    }
  }

  const hasExecutionSpecFromDb = Boolean(
    spec?.currentVersion &&
      spec.currentVersion.status === "APPROVED" &&
      (spec.currentVersion.approvalStage === "EXECUTION" ||
        spec.currentVersion.isExecutionBaseline),
  );

  return {
    hasExecutionSpec: hasExecutionSpecFromDb || base.hasExecutionSpec,
    hasRequiredHandoffFiles: base.hasRequiredHandoffFiles,
    handoffChecklistCompleted,
    bomApproved: base.bomApproved,
    criticalMaterialsReady: base.criticalMaterialsReady,
    deliveryAccepted: base.deliveryAccepted,
    financeActualsPosted: base.financeActualsPosted,
    productionDone: base.productionDone,
  };
}
