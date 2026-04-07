export type DealControlMeasurementV1 = {
  schema: "deal_control_measurement_v1";
  scheduledAt: string | null;
  completedAt: string | null;
  notes: string | null;
  mismatchDetected: boolean;
  /** Запит на повернення до прорахунку / нової версії КП */
  rollbackToEstimateRequested: boolean;
  /** ID вкладень (фото, схеми) */
  attachmentIds: string[];
};

export function parseDealControlMeasurement(
  raw: unknown,
): DealControlMeasurementV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== "deal_control_measurement_v1") return null;
  return {
    schema: "deal_control_measurement_v1",
    scheduledAt: typeof o.scheduledAt === "string" ? o.scheduledAt : null,
    completedAt: typeof o.completedAt === "string" ? o.completedAt : null,
    notes: typeof o.notes === "string" ? o.notes : null,
    mismatchDetected: o.mismatchDetected === true,
    rollbackToEstimateRequested: o.rollbackToEstimateRequested === true,
    attachmentIds: Array.isArray(o.attachmentIds)
      ? o.attachmentIds.filter((x): x is string => typeof x === "string")
      : [],
  };
}

export function emptyControlMeasurement(): DealControlMeasurementV1 {
  return {
    schema: "deal_control_measurement_v1",
    scheduledAt: null,
    completedAt: null,
    notes: null,
    mismatchDetected: false,
    rollbackToEstimateRequested: false,
    attachmentIds: [],
  };
}
