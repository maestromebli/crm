import { NextResponse } from "next/server";
import { enforceAiRequestLimit } from "./rate-limit";

export async function requireAiRateLimit(params: {
  userId: string;
  action: string;
  maxRequests: number;
  windowMinutes: number;
}): Promise<NextResponse | null> {
  const limit = await enforceAiRequestLimit(params);
  if (limit.allowed) return null;
  return NextResponse.json(
    {
      error: "Перевищено ліміт AI-запитів. Спробуйте пізніше.",
      code: "AI_RATE_LIMIT_EXCEEDED",
      retryAfterSec: limit.retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    },
  );
}
