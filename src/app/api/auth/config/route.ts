import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Публічна перевірка: чи збігається адреса в браузері з NEXTAUTH_URL (localhost ≠ 127.0.0.1).
 */
export async function GET() {
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim() || null;
  return NextResponse.json({ nextAuthUrl });
}
