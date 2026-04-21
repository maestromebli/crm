import { prisma } from "../prisma";

export type AiRateLimitResult = {
  allowed: boolean;
  used: number;
  max: number;
  retryAfterSec: number;
};

export async function enforceAiRequestLimit(params: {
  userId: string;
  action: string;
  maxRequests: number;
  windowMinutes: number;
}): Promise<AiRateLimitResult> {
  const { userId, action, maxRequests, windowMinutes } = params;
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      allowed: true,
      used: 0,
      max: maxRequests,
      retryAfterSec: 0,
    };
  }

  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const since = new Date(now - windowMs);
  try {
    const used = await prisma.aiAssistantLog.count({
      where: {
        userId,
        action,
        createdAt: { gte: since },
      },
    });
    if (used < maxRequests) {
      return { allowed: true, used, max: maxRequests, retryAfterSec: 0 };
    }
    return {
      allowed: false,
      used,
      max: maxRequests,
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  } catch {
    // Fail-open: availability важливіша за локальний збій лічильника.
    return {
      allowed: true,
      used: 0,
      max: maxRequests,
      retryAfterSec: 0,
    };
  }
}
