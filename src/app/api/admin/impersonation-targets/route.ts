import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth/options";
import { prisma } from "../../../../lib/prisma";

/**
 * Список користувачів для імпersonації (лише SUPER_ADMIN, реальна сесія).
 */
export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  if (session.user.realRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
      })),
    });
  } catch (e) {
     
    console.error("[GET impersonation-targets]", e);
    return NextResponse.json(
      { error: "Помилка завантаження" },
      { status: 500 },
    );
  }
}
