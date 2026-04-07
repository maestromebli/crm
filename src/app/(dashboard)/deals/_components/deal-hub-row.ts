/** Рядок таблиці / картки канбану модуля угод. */
export type DealHubRow = {
  id: string;
  title: string;
  stageId: string;
  stageName: string;
  /** Порядок стадії у воронці — для канбану колонки йдуть як у pipeline, не А→Я. */
  stageSortOrder: number;
  pipelineId: string;
  pipelineName: string;
  ownerId: string;
  clientName: string;
  value: number | null;
  currency: string | null;
  ownerName: string | null;
  updatedAt: string;
  nextStepLabel: string | null;
  nextActionAt: string | null;
  estimatesCount: number;
  warningBadge: "critical" | "warning" | null;
  paymentShort: string;
  status: string;
  hasContract: boolean;
};
