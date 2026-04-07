import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

/**
 * Лише для dev: чи збігається те, що бачить Next, з очікуваним admin@enver.com.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  let dbOk = false;
  let adminUserFound = false;
  let adminPasswordAdmin123 = false;
  let prismaError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    const u = await prisma.user.findFirst({
      where: { email: { equals: "admin@enver.com", mode: "insensitive" } },
      select: { passwordHash: true },
    });
    adminUserFound = Boolean(u);
    if (u) {
      adminPasswordAdmin123 = await bcrypt.compare("admin123", u.passwordHash);
    }
  } catch (e) {
    prismaError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    hasDatabaseUrl,
    cwd: process.cwd(),
    dbOk,
    adminUserFound,
    adminPasswordAdmin123,
    prismaError,
  });
}
