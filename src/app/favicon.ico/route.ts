import { NextResponse } from "next/server";

export function GET(req: Request) {
  try {
    return NextResponse.redirect(new URL("/favicon.svg", req.url), 307);
  } catch {
    // Fallback for malformed request URLs from certain dev tooling/browser probes.
    return new NextResponse(null, {
      status: 307,
      headers: { Location: "/favicon.svg" },
    });
  }
}
