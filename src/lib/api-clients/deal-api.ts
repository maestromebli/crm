import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import { fetchJson } from "./http-json";

/**
 * Оновлення `workspaceMeta` замовлення. Повного `GET …/workspace` JSON у проєкті немає —
 * робочий простір рендериться RSC-сторінкою `/deals/[dealId]/workspace`.
 */
export function patchDealWorkspaceMeta(
  dealId: string,
  patch: Partial<DealWorkspaceMeta>,
) {
  return fetchJson<unknown>(
    `/api/deals/${encodeURIComponent(dealId)}/workspace-meta`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}
