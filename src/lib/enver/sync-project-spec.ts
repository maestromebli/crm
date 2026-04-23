import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ProjectSpecMeta = {
  currentVersionId?: string;
  currentVersionNo?: number;
  approvalStage?: "commercial" | "client" | "technical" | "execution";
  currentVersionApprovedForExecution?: boolean;
  requiredFilesComplete?: boolean;
  approvedAt?: string;
};

type DealMetaShape = {
  projectSpec?: ProjectSpecMeta;
};

function parseMeta(raw: Prisma.JsonValue | null): DealMetaShape {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealMetaShape;
}

function mapApprovalStage(stage: ProjectSpecMeta["approvalStage"]) {
  switch (stage) {
    case "client":
      return "CLIENT" as const;
    case "technical":
      return "TECHNICAL" as const;
    case "execution":
      return "EXECUTION" as const;
    default:
      return "COMMERCIAL" as const;
  }
}

export async function syncProjectSpecFromDealMeta(args: {
  dealId: string;
  actorUserId: string;
}): Promise<{ synced: boolean; projectSpecId?: string; versionId?: string }> {
  const deal = await prisma.deal.findUnique({
    where: { id: args.dealId },
    select: { id: true, workspaceMeta: true },
  });
  if (!deal) return { synced: false };

  const meta = parseMeta(deal.workspaceMeta);
  const specMeta = meta.projectSpec;
  if (!specMeta) return { synced: false };

  const order = await prisma.order.findFirst({
    where: { dealId: deal.id },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!order) return { synced: false };

  const existing = await prisma.projectSpec.findUnique({
    where: { orderId: order.id },
    include: {
      currentVersion: { select: { id: true, versionNo: true } },
      versions: {
        orderBy: { versionNo: "desc" },
        take: 1,
        select: { id: true, versionNo: true },
      },
    },
  });

  const projectSpec =
    existing ??
    (await prisma.projectSpec.create({
      data: {
        orderId: order.id,
        dealId: deal.id,
        status: "DRAFT",
      },
    }));

  const targetVersionNo =
    typeof specMeta.currentVersionNo === "number" && specMeta.currentVersionNo > 0
      ? Math.trunc(specMeta.currentVersionNo)
      : existing?.versions[0]?.versionNo ?? 1;

  let version =
    existing?.versions.find((v) => v.versionNo === targetVersionNo) ?? null;
  if (!version) {
    version = await prisma.projectSpecVersion.create({
      data: {
        projectSpecId: projectSpec.id,
        versionNo: targetVersionNo,
        approvalStage: mapApprovalStage(specMeta.approvalStage),
        status: specMeta.currentVersionApprovedForExecution ? "APPROVED" : "DRAFT",
        isExecutionBaseline: specMeta.currentVersionApprovedForExecution === true,
        approvedAt:
          specMeta.currentVersionApprovedForExecution && specMeta.approvedAt
            ? new Date(specMeta.approvedAt)
            : null,
        approvedByUserId:
          specMeta.currentVersionApprovedForExecution === true
            ? args.actorUserId
            : null,
        createdById: args.actorUserId,
        notes:
          specMeta.requiredFilesComplete === true
            ? "required_files_complete=true"
            : undefined,
      },
      select: { id: true, versionNo: true },
    });
  }

  const nextStatus =
    specMeta.currentVersionApprovedForExecution === true
      ? "APPROVED_FOR_EXECUTION"
      : "UNDER_REVIEW";

  const updated = await prisma.projectSpec.update({
    where: { id: projectSpec.id },
    data: {
      dealId: deal.id,
      status: nextStatus,
      currentVersionId: version.id,
    },
    select: { id: true, currentVersionId: true },
  });

  return {
    synced: true,
    projectSpecId: updated.id,
    versionId: updated.currentVersionId ?? undefined,
  };
}
