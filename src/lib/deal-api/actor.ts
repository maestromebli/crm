import { prisma } from "../prisma";

/** Користувач для audit-логів API (dev: demo@enver.local або DEAL_API_ACTOR_USER_ID). */
export async function resolveDealApiActorUserId(): Promise<string | null> {
  const fromEnv = process.env.DEAL_API_ACTOR_USER_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const u = await prisma.user.findFirst({
      where: { email: "demo@enver.local" },
      select: { id: true },
    });
    return u?.id ?? null;
  } catch {
    return null;
  }
}
