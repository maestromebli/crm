import { NextResponse } from "next/server";

/**
 * Shared guard for API routes that require a configured database connection.
 */
export function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }
  return null;
}
