export const ENVER_SLO = {
  api: {
    availabilityTarget: 99.9,
    p95LatencyMs: 700,
    p99LatencyMs: 1500,
  },
  events: {
    outboxUnprocessedOlderThanMinutes: 5,
    failedProcessingRatePercent: 1,
  },
  workflows: {
    leadToDealConversionFailureRatePercent: 2,
    stageTransitionErrorRatePercent: 1,
  },
} as const;

