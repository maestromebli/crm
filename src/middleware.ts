import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import {
  isExactNavPathAllowed,
  sanitizeMenuAccess,
} from "./lib/navigation-access";

const REQUEST_ID_HEADER = "x-request-id";
const CORRELATION_ID_HEADER = "x-correlation-id";

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

const INACTIVITY_TIMEOUT_SECONDS = readPositiveIntEnv(
  "AUTH_INACTIVITY_TIMEOUT_SECONDS",
  60 * 60,
);
const DAILY_REAUTH_SECONDS = readPositiveIntEnv(
  "AUTH_DAILY_REAUTH_SECONDS",
  24 * 60 * 60,
);

function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function isTokenSessionExpired(
  token: Record<string, unknown> | null | undefined,
): boolean {
  if (!token) return false;
  if (typeof token.sessionExpiredAt === "number") return true;

  const now = nowUnixSeconds();
  const authenticatedAt =
    typeof token.authenticatedAt === "number"
      ? token.authenticatedAt
      : now;
  const lastActivityAt =
    typeof token.lastActivityAt === "number"
      ? token.lastActivityAt
      : now;

  return (
    now - authenticatedAt > DAILY_REAUTH_SECONDS ||
    now - lastActivityAt > INACTIVITY_TIMEOUT_SECONDS
  );
}

function getOrCreateHeader(req: Request, headerName: string): string {
  const existing = req.headers.get(headerName)?.trim();
  if (existing) return existing;
  return crypto.randomUUID();
}

function withTracingHeaders(req: Request, res: NextResponse): NextResponse {
  const requestId = getOrCreateHeader(req, REQUEST_ID_HEADER);
  const correlationId = getOrCreateHeader(req, CORRELATION_ID_HEADER);
  res.headers.set(REQUEST_ID_HEADER, requestId);
  res.headers.set(CORRELATION_ID_HEADER, correlationId);
  return res;
}

/**
 * Захист дашборду. `/login` доступний без сесії; з активною сесією — редірект у дашборд.
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as Record<string, unknown> | null;
    const sessionExpired = isTokenSessionExpired(token);

    if (req.nextUrl.pathname.startsWith("/p/")) {
      return withTracingHeaders(req, NextResponse.next());
    }

    if (req.nextUrl.pathname.startsWith("/c/")) {
      return withTracingHeaders(req, NextResponse.next());
    }

    /** Публічний робочий простір зовнішнього конструктора (токен у URL). */
    if (req.nextUrl.pathname.startsWith("/crm/external/")) {
      return withTracingHeaders(req, NextResponse.next());
    }

    if (req.nextUrl.pathname === "/login" && token && !sessionExpired) {
      return withTracingHeaders(
        req,
        NextResponse.redirect(new URL("/crm/dashboard", req.nextUrl.origin)),
      );
    }

    if (sessionExpired && req.nextUrl.pathname !== "/login") {
      return withTracingHeaders(
        req,
        NextResponse.redirect(new URL("/login?reason=session-expired", req.nextUrl.origin)),
      );
    }

    if (token) {
      const role = token.role as string | undefined;
      const impersonating = Boolean(token.impersonateUserId);
      const bypassMenuNav =
        !impersonating && (role === "SUPER_ADMIN" || role === "ADMIN");
      if (!bypassMenuNav) {
        const raw = token.menuAccess;
        const menuAccess =
          raw !== undefined && raw !== null
            ? sanitizeMenuAccess(raw) ?? null
            : null;
        if (
          !isExactNavPathAllowed(req.nextUrl.pathname, menuAccess)
        ) {
          return withTracingHeaders(
            req,
            NextResponse.redirect(
              new URL("/access-denied", req.nextUrl.origin),
            ),
          );
        }
      }
    }

    return withTracingHeaders(req, NextResponse.next());
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname === "/login") return true;
        if (req.nextUrl.pathname.startsWith("/p/")) return true;
        if (req.nextUrl.pathname.startsWith("/c/")) return true;
        if (req.nextUrl.pathname.startsWith("/crm/external/")) return true;
        if (!token) return false;
        return !isTokenSessionExpired(token as Record<string, unknown>);
      },
    },
  },
);

export const config = {
  matcher: [
    "/",
    "/login",
    "/access-denied",
    "/dashboard/:path*",
    "/leads/:path*",
    "/contacts/:path*",
    "/deals/:path*",
    "/calendar/:path*",
    "/inbox/:path*",
    "/production/:path*",
    "/handoff/:path*",
    "/tasks/:path*",
    "/today",
    "/files/:path*",
    "/library",
    "/library/:path*",
    "/warehouse/:path*",
    "/reports/:path*",
    "/target",
    "/target/:path*",
    "/settings/:path*",
    "/crm/:path*",
    "/p/:path*",
    "/c/:path*",
  ],
};
