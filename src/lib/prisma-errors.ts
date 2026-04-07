/**
 * Людинозчитні повідомлення для типових помилок Prisma (підключення, тощо).
 */

function isObjectWithCode(e: unknown): e is { code: string; message?: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
}

/** P1001 — сервер БД недоступний, P1002 — таймаут, P1017 — з’єднання закрито */
const CONNECTION_LIKE_CODES = new Set([
  "P1001",
  "P1002",
  "P1017",
]);

export function isDatabaseConnectionError(e: unknown): boolean {
  if (!isObjectWithCode(e)) return false;
  return CONNECTION_LIKE_CODES.has(e.code);
}

export function userFacingPrismaMessage(
  e: unknown,
  fallback: string,
): string {
  if (!isObjectWithCode(e)) {
    return fallback;
  }

  if (CONNECTION_LIKE_CODES.has(e.code)) {
    return (
      "Не вдається підключитися до PostgreSQL. Переконайтеся, що сервер БД запущений, " +
      "а в `.env.local` задано коректний `DATABASE_URL` " +
      "(наприклад `postgresql://USER:PASSWORD@127.0.0.1:5432/DBNAME`). " +
      "Потім: `pnpm db:push` та `pnpm db:seed`."
    );
  }

  if (e.code === "P1000") {
    return (
      "Помилка автентифікації PostgreSQL. Перевірте логін/пароль у `DATABASE_URL`."
    );
  }

  if (e.code === "P2021" || e.code === "P2022") {
    return (
      "Схема БД не відповідає очікуваній. Виконайте `pnpm db:push` або міграції."
    );
  }

  return fallback;
}

export function logPrismaError(context: string, e: unknown): void {
  if (isDatabaseConnectionError(e)) {
    if (process.env.NODE_ENV === "development") {
       
      console.warn(`[${context}] БД недоступна — показуємо підказку в UI.`);
    }
    return;
  }
   
  console.error(`[${context}]`, e);
}
