import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import {
  isExactNavPathAllowed,
  sanitizeMenuAccess,
} from "./lib/navigation-access";

/**
 * Захист дашборду. `/login` доступний без сесії; з активною сесією — редірект у дашборд.
 */
export default withAuth(
  function middleware(req) {
    if (req.nextUrl.pathname.startsWith("/p/")) {
      return NextResponse.next();
    }

    if (req.nextUrl.pathname.startsWith("/c/")) {
      return NextResponse.next();
    }

    /** Публічний робочий простір зовнішнього конструктора (токен у URL). */
    if (req.nextUrl.pathname.startsWith("/crm/external/")) {
      return NextResponse.next();
    }

    if (req.nextUrl.pathname === "/login" && req.nextauth.token) {
      return NextResponse.redirect(new URL("/crm/dashboard", req.nextUrl.origin));
    }

    const token = req.nextauth.token;
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
          return NextResponse.redirect(
            new URL("/access-denied", req.nextUrl.origin),
          );
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname === "/login") return true;
        if (req.nextUrl.pathname.startsWith("/p/")) return true;
        if (req.nextUrl.pathname.startsWith("/c/")) return true;
        if (req.nextUrl.pathname.startsWith("/crm/external/")) return true;
        return !!token;
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
