import { Prisma, type Role } from "@prisma/client";
import { prisma } from "../prisma";

export type UserRowWithMenuAccess = {
  id: string;
  role: Role;
  email: string;
  name: string | null;
  menuAccess: unknown | null;
  permissions: { permission: { key: string } }[];
};

const selectWithMenu = {
  id: true,
  role: true,
  email: true,
  name: true,
  menuAccess: true,
  permissions: { include: { permission: true } },
} as const;

const selectWithoutMenu = {
  id: true,
  role: true,
  email: true,
  name: true,
  permissions: { include: { permission: true } },
} as const;

/**
 * Якщо після оновлення схеми не виконали `pnpm prisma generate`, клієнт не знає `menuAccess`
 * і кидає PrismaClientValidationError — повторюємо запит без цього поля (menuAccess = null).
 */
export async function findFirstUserRowWithMenuAccessFallback(
  where: Prisma.UserWhereInput,
): Promise<UserRowWithMenuAccess | null> {
  try {
    const r = await prisma.user.findFirst({
      where,
      select: selectWithMenu,
    });
    if (!r) return null;
    return {
      id: r.id,
      role: r.role,
      email: r.email,
      name: r.name,
      menuAccess: r.menuAccess,
      permissions: r.permissions,
    };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientValidationError &&
      e.message.includes("menuAccess")
    ) {
      const r = await prisma.user.findFirst({
        where,
        select: selectWithoutMenu,
      });
      if (!r) return null;
      return {
        id: r.id,
        role: r.role,
        email: r.email,
        name: r.name,
        menuAccess: null,
        permissions: r.permissions,
      };
    }
    throw e;
  }
}

export async function findUserRowWithMenuAccessFallback(where: {
  id: string;
}): Promise<UserRowWithMenuAccess | null> {
  return findFirstUserRowWithMenuAccessFallback(where);
}
