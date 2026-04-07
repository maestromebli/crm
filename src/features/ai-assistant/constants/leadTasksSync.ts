/**
 * Події після зміни задач по ліду / угоді — синхронізація AI-помічника та пов’язаних карток UI.
 */
export const ENVER_LEAD_TASKS_UPDATED_EVENT = "enver:leadTasksUpdated" as const;

export type EnverLeadTasksUpdatedDetail = {
  leadId: string;
};

/** Оновлення даних угоди (RSC) після мутацій задач — слухач викликає `router.refresh()`. */
export const ENVER_DEAL_TASKS_UPDATED_EVENT = "enver:dealTasksUpdated" as const;

export type EnverDealTasksUpdatedDetail = {
  dealId: string;
};
