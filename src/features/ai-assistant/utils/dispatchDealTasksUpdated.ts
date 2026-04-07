import type { EnverDealTasksUpdatedDetail } from "../constants/leadTasksSync";
import { ENVER_DEAL_TASKS_UPDATED_EVENT } from "../constants/leadTasksSync";

/** Після зміни задач по угоді — оновлення `DealWorkspaceShell` та знімка помічника. */
export function dispatchDealTasksUpdated(detail: EnverDealTasksUpdatedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<EnverDealTasksUpdatedDetail>(ENVER_DEAL_TASKS_UPDATED_EVENT, {
      detail,
    }),
  );
}
