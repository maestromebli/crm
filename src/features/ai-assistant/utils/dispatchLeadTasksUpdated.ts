import type { EnverLeadTasksUpdatedDetail } from "../constants/leadTasksSync";
import { ENVER_LEAD_TASKS_UPDATED_EVENT } from "../constants/leadTasksSync";

/** Викликати після успішної мутації задач по ліду (клієнт лише). */
export function dispatchLeadTasksUpdated(detail: EnverLeadTasksUpdatedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<EnverLeadTasksUpdatedDetail>(ENVER_LEAD_TASKS_UPDATED_EVENT, {
      detail,
    }),
  );
}
