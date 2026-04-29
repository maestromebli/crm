import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteRateLimitSubjectType = "user" | "ip" | "token" | "webhook" | "workspace";
type RouteRateLimitSubject = {
  type: RouteRateLimitSubjectType;
  value: string;
};

type RouteRateLimitParams = {
  action: string;
  subject: RouteRateLimitSubject;
  maxRequests: number;
  windowMinutes: number;
};

type RouteRateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

const RATE_LIMIT_EVENT_TYPE = "platform.rate_limit.route";
const RATE_LIMIT_ENTITY_TYPE = "ROUTE_RATE_LIMIT";

function hashSubjectValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function buildBucketId(action: string, subject: RouteRateLimitSubject): string {
  const actionKey = action.trim().toLowerCase();
  const subjectHash = hashSubjectValue(subject.value.trim());
  return `${actionKey}:${subject.type}:${subjectHash}`;
}

function readHeaderIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.trim();
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return null;
}

export function resolveRateLimitSubjectFromRequest(
  req: Request,
  action: string,
  preferredUserId?: string | null,
): RouteRateLimitSubject {
  const trimmedUserId = preferredUserId?.trim();
  if (trimmedUserId) {
    return { type: "user", value: trimmedUserId };
  }
  const ip = readHeaderIp(req) ?? "unknown-ip";
  return { type: "ip", value: `${action}:${ip}` };
}

export async function enforceRouteRateLimit(
  params: RouteRateLimitParams,
): Promise<RouteRateLimitResult> {
  const { action, subject, maxRequests, windowMinutes } = params;
  if (!process.env.DATABASE_URL?.trim()) {
    return { allowed: true, retryAfterSec: 0 };
  }

  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const since = new Date(now - windowMs);
  const actionKey = action.trim().toLowerCase();
  const bucketId = buildBucketId(actionKey, subject);

  try {
    const used = await prisma.domainEvent.count({
      where: {
        type: RATE_LIMIT_EVENT_TYPE,
        entityType: RATE_LIMIT_ENTITY_TYPE,
        entityId: bucketId,
        createdAt: { gte: since },
      },
    });

    if (used >= maxRequests) {
      const oldest = await prisma.domainEvent.findFirst({
        where: {
          type: RATE_LIMIT_EVENT_TYPE,
          entityType: RATE_LIMIT_ENTITY_TYPE,
          entityId: bucketId,
          createdAt: { gte: since },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      const retryAfterSec = oldest
        ? Math.max(
            1,
            Math.ceil((oldest.createdAt.getTime() + windowMs - now) / 1000),
          )
        : Math.ceil(windowMs / 1000);
      return { allowed: false, retryAfterSec };
    }

    await prisma.domainEvent.create({
      data: {
        type: RATE_LIMIT_EVENT_TYPE,
        entityType: RATE_LIMIT_ENTITY_TYPE,
        entityId: bucketId,
        userId: subject.type === "user" ? subject.value.trim() : null,
        payload: {
          action: actionKey,
          subjectType: subject.type,
          subjectHash: hashSubjectValue(subject.value),
          maxRequests,
          windowMinutes,
        },
        processedAt: new Date(),
      },
    });

    return { allowed: true, retryAfterSec: 0 };
  } catch {
    // Fail-open to preserve route availability during temporary DB issues.
    return { allowed: true, retryAfterSec: 0 };
  }
}

export async function requireRouteRateLimit(
  params: RouteRateLimitParams,
): Promise<NextResponse | null> {
  const limit = await enforceRouteRateLimit(params);
  if (limit.allowed) return null;
  return NextResponse.json(
    {
      error: "Занадто багато запитів. Спробуйте трохи пізніше.",
      code: "ROUTE_RATE_LIMIT_EXCEEDED",
      retryAfterSec: limit.retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    },
  );
}

export async function requireRouteRateLimitByRequest(params: {
  req: Request;
  action: string;
  maxRequests: number;
  windowMinutes: number;
  preferredUserId?: string | null;
  fallbackSubjectType?: Exclude<RouteRateLimitSubjectType, "user">;
  fallbackSubjectValue?: string | null;
}): Promise<NextResponse | null> {
  const {
    req,
    action,
    maxRequests,
    windowMinutes,
    preferredUserId,
    fallbackSubjectType,
    fallbackSubjectValue,
  } = params;
  const trimmedUserId = preferredUserId?.trim();
  const subject: RouteRateLimitSubject = trimmedUserId
    ? { type: "user", value: trimmedUserId }
    : fallbackSubjectType && fallbackSubjectValue?.trim()
      ? { type: fallbackSubjectType, value: fallbackSubjectValue.trim() }
      : resolveRateLimitSubjectFromRequest(req, action, trimmedUserId);
  return requireRouteRateLimit({
    action,
    subject,
    maxRequests,
    windowMinutes,
  });
}
