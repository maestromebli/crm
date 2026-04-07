import { NextResponse } from "next/server";

/** Перевірка, що сервер Next.js запущений (без авторизації). */
export async function GET() {
  return NextResponse.json({ ok: true, service: "enver-crm" });
}
