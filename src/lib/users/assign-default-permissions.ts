import type { PermissionKey, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { getDefaultPermissionKeysForRole } from "../authz/role-access-policy";

async function grantAllPermissions(userId: string) {
  const all = await prisma.permission.findMany({ select: { id: true } });
  await prisma.permissionOnUser.createMany({
    data: all.map((p) => ({ userId, permissionId: p.id })),
    skipDuplicates: true,
  });
}

async function grantKeys(userId: string, keys: readonly PermissionKey[]) {
  for (const key of keys) {
    const p = await prisma.permission.findUnique({ where: { key } });
    if (!p) continue;
    await prisma.permissionOnUser.upsert({
      where: {
        userId_permissionId: { userId, permissionId: p.id },
      },
      update: {},
      create: { userId, permissionId: p.id },
    });
  }
}

/**
 * Клонує PermissionOnUser з найстарішого іншого користувача з тією ж роллю;
 * інакше — дефолти з {@link getDefaultPermissionKeysForRole}.
 */
export async function assignDefaultPermissionsForNewUser(
  userId: string,
  role: Role,
): Promise<void> {
  const template = await prisma.user.findFirst({
    where: { role, id: { not: userId } },
    orderBy: { createdAt: "asc" },
    select: {
      permissions: { select: { permissionId: true } },
    },
  });

  if (template?.permissions.length) {
    await prisma.permissionOnUser.createMany({
      data: template.permissions.map((x) => ({
        userId,
        permissionId: x.permissionId,
      })),
      skipDuplicates: true,
    });
    return;
  }

  const mode = getDefaultPermissionKeysForRole(role);
  if (mode === "ALL") {
    await grantAllPermissions(userId);
  } else {
    await grantKeys(userId, mode);
  }
}
