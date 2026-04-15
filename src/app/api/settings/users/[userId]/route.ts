import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PermissionKey, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import {
  canAssignSuperAdminRole,
  hasEffectivePermission,
  P,
} from "../../../../../lib/authz/permissions";
import { generateSecurePassword } from "../../../../../lib/auth/generate-password";
import { settingsUsersListWhere } from "../../../../../lib/authz/data-scope";
import {
  buildNavManifest,
  sanitizeMenuAccess,
} from "../../../../../lib/navigation-access";
import { findFirstUserRowWithMenuAccessFallback } from "../../../../../lib/users/user-row-with-menu-access";

export const runtime = "nodejs";

const patchBody = z
  .object({
    password: z.string().min(8).max(128).optional(),
    generatePassword: z.boolean().optional(),
    name: z.string().trim().max(200).optional().nullable(),
    role: z.nativeEnum(Role).optional(),
    menuAccess: z.unknown().optional(),
    permissionKey: z.nativeEnum(PermissionKey).optional(),
    permissionGranted: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.permissionKey === undefined ||
      d.permissionGranted !== undefined,
    { message: "Поле `permissionGranted` обовʼязкове разом із `permissionKey`" },
  )
  .refine(
    (d) =>
      d.permissionGranted === undefined ||
      d.permissionKey !== undefined,
    { message: "Поле `permissionKey` обовʼязкове разом із `permissionGranted`" },
  );

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json(
        { error: "DATABASE_URL не задано" },
        { status: 503 },
      );
    }

    const sessionUser = await requireSessionUser();
    if (sessionUser instanceof NextResponse) return sessionUser;

    const viewDenied = forbidUnlessPermission(sessionUser, P.USERS_VIEW);
    if (viewDenied) return viewDenied;

    const { userId } = await ctx.params;
    const listWhere = await settingsUsersListWhere(prisma, sessionUser);

    const target = await findFirstUserRowWithMenuAccessFallback({
      AND: [{ id: userId }, ...(listWhere ? [listWhere] : [])],
    });

    if (!target) {
      return NextResponse.json(
        { error: "Користувача не знайдено" },
        { status: 404 },
      );
    }

    const canManage = hasEffectivePermission(
      sessionUser.permissionKeys,
      P.USERS_MANAGE,
      {
        realRole: sessionUser.realRole,
        impersonatorId: sessionUser.impersonatorId,
      },
    );

    return NextResponse.json({
      user: {
        id: target.id,
        email: target.email,
        name: target.name,
        role: target.role,
      },
      permissionKeys: target.permissions.map((p) => p.permission.key),
      menuAccess: sanitizeMenuAccess(target.menuAccess),
      navManifest: buildNavManifest(),
      canManage,
      canAssignSuperAdmin: canAssignSuperAdminRole({
        realRole: sessionUser.realRole,
      }),
    });
  } catch (err) {
     
    console.error("[GET /api/settings/users/[userId]]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Внутрішня помилка сервера",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json(
        { error: "DATABASE_URL не задано" },
        { status: 503 },
      );
    }

    const sessionUser = await requireSessionUser();
    if (sessionUser instanceof NextResponse) return sessionUser;

    const denied = forbidUnlessPermission(sessionUser, P.USERS_MANAGE);
    if (denied) return denied;

    const { userId } = await ctx.params;

    let body: z.infer<typeof patchBody>;
    try {
      body = patchBody.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "Некоректні дані" }, { status: 400 });
    }

    const listWhere = await settingsUsersListWhere(prisma, sessionUser);
    const target = await prisma.user.findFirst({
      where: {
        AND: [{ id: userId }, ...(listWhere ? [listWhere] : [])],
      },
      select: { id: true, role: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Користувача не знайдено" },
        { status: 404 },
      );
    }

    if (
      target.role === "SUPER_ADMIN" &&
      !canAssignSuperAdminRole({ realRole: sessionUser.realRole })
    ) {
      return NextResponse.json(
        { error: "Лише SUPER_ADMIN може змінювати цього користувача" },
        { status: 403 },
      );
    }

    const wantsPassword =
      (typeof body.password === "string" &&
        body.password.trim().length >= 8) ||
      body.generatePassword === true;

    if (wantsPassword) {
      const hasPw =
        typeof body.password === "string" && body.password.trim().length >= 8;
      if (!hasPw && body.generatePassword !== true) {
        return NextResponse.json(
          {
            error:
              "Вкажіть пароль (мін. 8 символів) або надішліть generatePassword: true",
          },
          { status: 400 },
        );
      }

      let plain: string;
      let generated = false;
      if (hasPw) {
        plain = body.password!.trim();
      } else {
        plain = generateSecurePassword(14);
        generated = true;
      }

      const passwordHash = await bcrypt.hash(plain, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      if (
        body.name === undefined &&
        body.role === undefined &&
        body.menuAccess === undefined &&
        body.permissionKey === undefined
      ) {
        return NextResponse.json({
          ok: true,
          ...(generated ? { generatedPassword: plain } : {}),
        });
      }
    }

    if (
      body.role === "SUPER_ADMIN" &&
      !canAssignSuperAdminRole({ realRole: sessionUser.realRole })
    ) {
      return NextResponse.json(
        { error: "Лише SUPER_ADMIN може призначати роль SUPER_ADMIN" },
        { status: 403 },
      );
    }

    if (body.name !== undefined || body.role !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(body.name !== undefined
            ? { name: body.name?.trim() || null }
            : {}),
          ...(body.role !== undefined ? { role: body.role } : {}),
        },
      });
    }

    if (body.menuAccess !== undefined) {
      const sanitized =
        body.menuAccess === null
          ? null
          : sanitizeMenuAccess(body.menuAccess);
      await prisma.user.update({
        where: { id: userId },
        data: { menuAccess: sanitized },
      });
    }

    if (
      body.permissionKey !== undefined &&
      body.permissionGranted !== undefined
    ) {
      const perm = await prisma.permission.findUnique({
        where: { key: body.permissionKey },
        select: { id: true },
      });
      if (!perm) {
        return NextResponse.json({ error: "Невідоме право" }, { status: 400 });
      }
      if (body.permissionGranted) {
        await prisma.permissionOnUser.upsert({
          where: {
            userId_permissionId: { userId, permissionId: perm.id },
          },
          create: { userId, permissionId: perm.id },
          update: {},
        });
      } else {
        await prisma.permissionOnUser.deleteMany({
          where: { userId, permissionId: perm.id },
        });
      }
    }

    const fresh = await findFirstUserRowWithMenuAccessFallback({
      id: userId,
    });

    return NextResponse.json({
      ok: true,
      user: fresh
        ? {
            id: fresh.id,
            email: fresh.email,
            name: fresh.name,
            role: fresh.role,
          }
        : undefined,
      permissionKeys: fresh?.permissions.map((p) => p.permission.key) ?? [],
      menuAccess: fresh ? sanitizeMenuAccess(fresh.menuAccess) : null,
    });
  } catch (err) {
     
    console.error("[PATCH /api/settings/users/[userId]]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Внутрішня помилка сервера",
      },
      { status: 500 },
    );
  }
}
