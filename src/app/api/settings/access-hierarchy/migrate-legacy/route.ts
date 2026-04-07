import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";

const SETTINGS_ID = "default";
const ACCESS_HIERARCHY_KEY = "__accessHierarchy";
const MANAGER_ROLES = ["SALES_MANAGER", "USER"] as const;

type LegacyMap = Record<string, string[]>;
type HeadMigrationPlan = {
  headId: string;
  requestedMembers: number;
  validMembers: number;
  toUnassign: number;
};

function parseLegacyAccessHierarchy(raw: unknown): LegacyMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: LegacyMap = {};
  for (const [headId, members] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(members)) continue;
    out[headId] = [...new Set(
      members
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean),
    )];
  }
  return out;
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.USERS_MANAGE);
  if (denied) return denied;
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const confirmed = url.searchParams.get("confirm") === "YES";

  const settings = await prisma.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { communicationsJson: true },
  });
  const root =
    settings?.communicationsJson &&
    typeof settings.communicationsJson === "object" &&
    !Array.isArray(settings.communicationsJson)
      ? (settings.communicationsJson as Record<string, unknown>)
      : {};

  const legacy = parseLegacyAccessHierarchy(root[ACCESS_HIERARCHY_KEY]);
  const legacyHeadIds = Object.keys(legacy);
  if (!legacyHeadIds.length) {
    return NextResponse.json({
      ok: true,
      migrated: false,
      message: "Legacy-ієрархію не знайдено",
      processedHeads: 0,
      assignedMembers: 0,
    });
  }

  const headRows = await prisma.user.findMany({
    where: { id: { in: legacyHeadIds }, role: "HEAD_MANAGER" },
    select: { id: true },
  });
  const validHeadIds = new Set(headRows.map((h) => h.id));

  let processedHeads = 0;
  let assignedMembers = 0;
  const heads: HeadMigrationPlan[] = [];

  for (const headId of legacyHeadIds) {
    if (!validHeadIds.has(headId)) continue;
    const memberIds = legacy[headId] ?? [];
    processedHeads += 1;

    const validMembers = await prisma.user.findMany({
      where: {
        id: { in: memberIds.length ? memberIds : ["__none__"] },
        role: { in: [...MANAGER_ROLES] },
      },
      select: { id: true },
    });
    const validMemberIds = validMembers.map((m) => m.id);
    const toUnassign = await prisma.user.count({
      where: {
        headManagerId: headId,
        role: { in: [...MANAGER_ROLES] },
        id: { notIn: validMemberIds.length ? validMemberIds : ["__none__"] },
      },
    });

    heads.push({
      headId,
      requestedMembers: memberIds.length,
      validMembers: validMemberIds.length,
      toUnassign,
    });
    assignedMembers += validMemberIds.length;
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      migrated: false,
      dryRun: true,
      processedHeads,
      assignedMembers,
      heads,
      wouldCleanLegacyKey: ACCESS_HIERARCHY_KEY,
    });
  }

  if (!confirmed) {
    return NextResponse.json(
      {
        error:
          "Підтвердіть виконання: додайте `?confirm=YES` або використайте `?dryRun=1` для перевірки.",
        processedHeads,
        assignedMembers,
      },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const head of heads) {
      const memberIds = legacy[head.headId] ?? [];
      await tx.user.updateMany({
        where: {
          headManagerId: head.headId,
          role: { in: [...MANAGER_ROLES] },
          id: { notIn: memberIds.length ? memberIds : ["__none__"] },
        },
        data: { headManagerId: null },
      });
      if (memberIds.length) {
        await tx.user.updateMany({
          where: {
            id: { in: memberIds },
            role: { in: [...MANAGER_ROLES] },
          },
          data: { headManagerId: head.headId },
        });
      }
    }

    const nextRoot = { ...root };
    delete nextRoot[ACCESS_HIERARCHY_KEY];
    await tx.systemSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        communicationsJson: nextRoot as object,
        updatedById: user.id,
      },
      update: {
        communicationsJson: nextRoot as object,
        updatedById: user.id,
      },
    });
  });

  return NextResponse.json({
    ok: true,
    migrated: true,
    dryRun: false,
    processedHeads,
    assignedMembers,
    heads,
    cleanedLegacyKey: ACCESS_HIERARCHY_KEY,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  url.searchParams.set("dryRun", "1");
  const proxyReq = new Request(url.toString(), { method: "POST", headers: req.headers });
  return POST(proxyReq);
}

