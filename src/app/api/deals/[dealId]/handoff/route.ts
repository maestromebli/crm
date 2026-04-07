import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { HandoffStatus } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import { dispatchDealAutomationTrigger } from "../../../../../lib/automation/dispatch";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import {
  allReadinessMet,
  evaluateReadiness,
} from "@/lib/deal-core/readiness";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import { parseHandoffManifest } from "../../../../../lib/deals/document-templates";

type Ctx = { params: Promise<{ dealId: string }> };

const STATUSES: HandoffStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
];

function isHandoffStatus(v: string): v is HandoffStatus {
  return STATUSES.includes(v as HandoffStatus);
}

function parseMeta(raw: unknown): DealWorkspaceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealWorkspaceMeta;
}

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        contract: { select: { status: true } },
      },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
    if (denied) return denied;

    const row = await prisma.dealHandoff.upsert({
      where: { dealId },
      create: { dealId },
      update: {},
    });

    return NextResponse.json({
      id: row.id,
      status: row.status,
      manifestJson: row.manifestJson,
      notes: row.notes,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      rejectionReason: row.rejectionReason,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
     
    console.error("[GET deal handoff]", e);
    return NextResponse.json({ error: "Помилка завантаження" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  let body: {
    status?: string;
    notes?: string | null;
    manifestJson?: unknown;
    rejectionReason?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        contract: { select: { status: true } },
      },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const requestedStatus = body.status;
    const requiredPermission =
      requestedStatus === "ACCEPTED" || requestedStatus === "REJECTED"
        ? P.HANDOFF_ACCEPT
        : P.HANDOFF_SUBMIT;
    const denied = await forbidUnlessDealAccess(user, requiredPermission, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const userId = user.id;

    const current = await prisma.dealHandoff.upsert({
      where: { dealId },
      create: { dealId },
      update: {},
    });

    const data: {
      status?: HandoffStatus;
      notes?: string | null;
      manifestJson?: object | null;
      submittedAt?: Date | null;
      acceptedAt?: Date | null;
      rejectedAt?: Date | null;
      rejectionReason?: string | null;
    } = {};

    if (body.notes !== undefined) {
      data.notes =
        body.notes === null ? null : String(body.notes).slice(0, 20000);
    }
    if (body.manifestJson !== undefined) {
      if (body.manifestJson === null) {
        data.manifestJson = null;
      } else if (
        typeof body.manifestJson === "object" &&
        !Array.isArray(body.manifestJson)
      ) {
        const manifest = parseHandoffManifest(body.manifestJson);
        data.manifestJson = manifest as unknown as object;
      } else {
        return NextResponse.json(
          { error: "manifestJson має бути об'єктом або null" },
          { status: 400 },
        );
      }
    }

    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !isHandoffStatus(body.status)) {
        return NextResponse.json({ error: "Некоректний статус" }, { status: 400 });
      }
      const next = body.status;
      const prev = current.status;

      if (next === "SUBMITTED") {
        if (prev !== "DRAFT" && prev !== "REJECTED") {
          return NextResponse.json(
            { error: "Відправка можлива лише з DRAFT або REJECTED" },
            { status: 400 },
          );
        }
        const manifest = parseHandoffManifest(
          data.manifestJson ?? current.manifestJson,
        );
        if (
          manifest.selectedAttachmentIds.length === 0 &&
          manifest.selectedFileAssetIds.length === 0
        ) {
          return NextResponse.json(
            {
              error:
                "Відправка неможлива: виберіть файли для передачі у пакеті handoff.",
            },
            { status: 400 },
          );
        }
        data.status = next;
        data.submittedAt = new Date();
        data.acceptedAt = null;
        data.rejectedAt = null;
        data.rejectionReason = null;
      } else if (next === "ACCEPTED") {
        if (prev !== "SUBMITTED") {
          return NextResponse.json(
            { error: "Прийняття можливе лише з SUBMITTED" },
            { status: 400 },
          );
        }
        const manifest = parseHandoffManifest(
          data.manifestJson ?? current.manifestJson,
        );
        if (
          manifest.selectedAttachmentIds.length === 0 &&
          manifest.selectedFileAssetIds.length === 0
        ) {
          return NextResponse.json(
            {
              error:
                "Прийняття неможливе: пакет передачі не містить обраних файлів.",
            },
            { status: 400 },
          );
        }
        const attachments = await prisma.attachment.findMany({
          where: { entityType: "DEAL", entityId: deal.id },
          select: { category: true },
        });
        const attachmentsByCategory: Record<string, number> = {};
        for (const a of attachments) {
          attachmentsByCategory[a.category] =
            (attachmentsByCategory[a.category] ?? 0) + 1;
        }
        const meta = parseMeta(deal.workspaceMeta);
        const checks = evaluateReadiness({
          meta,
          contractStatus: deal.contract?.status ?? null,
          attachmentsByCategory,
        });
        if (!allReadinessMet(checks)) {
          return NextResponse.json(
            {
              error:
                "Прийняття передачі заблоковано: не всі умови готовності виконані.",
              checks,
            },
            { status: 400 },
          );
        }
        data.status = next;
        data.acceptedAt = new Date();
      } else if (next === "REJECTED") {
        if (prev !== "SUBMITTED") {
          return NextResponse.json(
            { error: "Відхилення можливе лише з SUBMITTED" },
            { status: 400 },
          );
        }
        const reason =
          typeof body.rejectionReason === "string"
            ? body.rejectionReason.trim()
            : "";
        if (!reason) {
          return NextResponse.json(
            { error: "Для відхилення потрібен rejectionReason" },
            { status: 400 },
          );
        }
        data.status = next;
        data.rejectedAt = new Date();
        data.rejectionReason = reason.slice(0, 5000);
      } else if (next === "DRAFT") {
        if (prev !== "REJECTED") {
          return NextResponse.json(
            { error: "Повернення в DRAFT лише з REJECTED" },
            { status: 400 },
          );
        }
        data.status = next;
        data.submittedAt = null;
        data.rejectedAt = null;
        data.rejectionReason = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Немає полів для оновлення" },
        { status: 400 },
      );
    }

    const row = await prisma.dealHandoff.update({
      where: { dealId },
      data,
    });

    if (body.manifestJson !== undefined) {
      const meta = parseMeta(deal.workspaceMeta);
      const manifest = parseHandoffManifest(
        row.manifestJson as Record<string, unknown> | null,
      );
      const hasFiles =
        manifest.selectedAttachmentIds.length > 0 ||
        manifest.selectedFileAssetIds.length > 0;
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          workspaceMeta: {
            ...meta,
            handoffPackageReady: hasFiles,
          },
        },
      });
    }

    if (body.status === "SUBMITTED") {
      await appendActivityLog({
        entityType: "DEAL",
        entityId: dealId,
        type: "HANDOFF_SUBMITTED",
        actorUserId: userId,
        data: { handoffId: row.id },
      });
    } else if (body.status === "ACCEPTED") {
      await appendActivityLog({
        entityType: "DEAL",
        entityId: dealId,
        type: "HANDOFF_ACCEPTED",
        actorUserId: userId,
        data: { handoffId: row.id },
      });
      await dispatchDealAutomationTrigger({
        dealId,
        trigger: "HANDOFF_ACCEPTED",
        payload: { dealId, handoffId: row.id },
        startedById: userId,
      });
    } else if (body.status === "REJECTED") {
      await appendActivityLog({
        entityType: "DEAL",
        entityId: dealId,
        type: "HANDOFF_REJECTED",
        actorUserId: userId,
        data: { handoffId: row.id, reason: row.rejectionReason },
      });
    }

    revalidatePath(`/deals/${dealId}/workspace`);
    revalidatePath("/production");
    return NextResponse.json({
      id: row.id,
      status: row.status,
      manifestJson: row.manifestJson,
      notes: row.notes,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      rejectionReason: row.rejectionReason,
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
     
    console.error("[PATCH deal handoff]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
