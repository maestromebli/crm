import { getRequestContext } from "@/lib/platform";
import { jsonContractSuccess } from "@/lib/api/contract";

/** Перевірка, що сервер Next.js запущений (без авторизації). */
export async function GET(req: Request) {
  const requestCtx = getRequestContext(req);
  return jsonContractSuccess(requestCtx, {
    service: "enver-crm",
    status: "up",
  });
}
