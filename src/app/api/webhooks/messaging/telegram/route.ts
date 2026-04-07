import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Точка входу для Telegram Bot webhook. Поки не підключено — повертаємо зрозумілий JSON.
 * Після налаштування `TELEGRAM_BOT_TOKEN` + webhook URL — підключити `telegram-ingest` service.
 */
export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    {
      ok: false,
      code: "integration_not_configured",
      message:
        "Webhook прийнято, але інтеграція Telegram не активована на сервері. Налаштуйте токен і обробник угруповання повідомлень.",
    },
    { status: 200 },
  );
}
