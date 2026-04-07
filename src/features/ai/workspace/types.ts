/** Відповідь GET /api/ai/workspace для AI-панелі (українською). */
export type AiWorkspacePayload = {
  entity: "lead" | "deal";
  entityId: string;
  title: string;
  stageLabel: string | null;
  pipelineName: string | null;
  generatedAt: string;
  blocks: {
    /** «Що відбувається» */
    whatsHappening: string;
    /** «Наступний крок» */
    nextStep: string;
    /** «Що відсутнє» */
    missing: string[];
    /** «Ризики» */
    risks: string[];
    /** Короткі підказки для швидких дій (не кнопки) */
    quickHints: string[];
    /** «AI-підсумок» — узагальнення на основі даних CRM */
    aiSummary: string;
    /** Підтверджені дані з CRM */
    confirmedFacts: string[];
    /** Припущення / що варто перевірити */
    inferredNotes: string[];
  };
  modules: {
    timeline?: {
      summaryLine: string;
      lastClientTouchHours: number | null;
      openQuestions: string[];
    };
    files?: {
      total: number;
      processing: number;
      failed: number;
    };
    estimate?: {
      version: number | null;
      totalPrice: number | null;
      hints: string[];
    };
    quote?: {
      status: string | null;
      version: number | null;
      sentAt: string | null;
      hints: string[];
    };
    contract?: {
      status: string | null;
      hints: string[];
    };
    finance?: { hidden: true } | { hints: string[] };
    production?: {
      score0to100: number | null;
      recommendation: "ready" | "not_ready" | "partial" | "unknown";
      blockers: string[];
      warnings: string[];
      checklistHint: string[];
    };
  };
};
