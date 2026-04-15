import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import {
  canAssignSuperAdminRole,
  hasEffectivePermission,
  P,
} from "../../../../lib/authz/permissions";
import { generateSecurePassword } from "../../../../lib/auth/generate-password";
import { assignDefaultPermissionsForNewUser } from "../../../../lib/users/assign-default-permissions";
import { settingsUsersListWhere } from "../../../../lib/authz/data-scope";

export const runtime = "nodejs";

const postBody = z.object({
  email: z.string().email(),
  name: z.string().trim().max(200).optional().nullable(),
  role: z.nativeEnum(Role),
  password: z.string().min(8).max(128).optional().nullable().or(z.literal("")),
});

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.USERS_VIEW);
  if (denied) return denied;

  const listWhere = await settingsUsersListWhere(prisma, user);
  const rows = await prisma.user.findMany({
    where: listWhere,
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });

  const canManage = hasEffectivePermission(user.permissionKeys, P.USERS_MANAGE, {
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  });
  const canAssignSuperAdmin = canAssignSuperAdminRole({
    realRole: user.realRole,
  });

  return NextResponse.json({
    users: rows,
    canManage,
    canAssignSuperAdmin,
  });
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

  let body: z.infer<typeof postBody>;
  try {
    body = postBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Некоректні дані" }, { status: 400 });
  }

  if (
    body.role === "SUPER_ADMIN" &&
    !canAssignSuperAdminRole({ realRole: user.realRole })
  ) {
    return NextResponse.json(
      { error: "Лише SUPER_ADMIN може створювати SUPER_ADMIN" },
      { status: 403 },
    );
  }

  const email = body.email.trim().toLowerCase();
  const rawPassword = body.password?.trim();
  let plain: string;
  let generated = false;
  if (!rawPassword) {
    plain = generateSecurePassword(14);
    generated = true;
  } else {
    plain = rawPassword;
  }

  const passwordHash = await bcrypt.hash(plain, 10);

  try {
    const created = await prisma.user.create({
      data: {
        email,
        name: body.name?.trim() || null,
        role: body.role,
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    await assignDefaultPermissionsForNewUser(created.id, body.role);

    return NextResponse.json({
      user: created,
      ...(generated ? { generatedPassword: plain } : {}),
    });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Користувач з таким email вже існує" },
        { status: 409 },
      );
    }
     
    console.error("[POST /api/settings/users]", e);
    return NextResponse.json({ error: "Не вдалося створити користувача" }, { status: 500 });
  }
}
