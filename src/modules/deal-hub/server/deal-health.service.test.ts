import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDealHealth } from "./deal-health.service";

test("стан engine returns warning/risk when major signals exist", () => {
  const aggregate = {
    deal: {
      stage: { slug: "production" },
      workspaceMeta: {},
      paymentMilestones: [{ confirmedAt: null, dueAt: new Date("2020-01-01") }],
      financeSnapshots: [{ marginPct: 10 }],
      productionFlow: null,
      installationDate: null,
    },
    openTasks: [{ dueAt: new Date("2020-01-02") }],
    latestAttachments: [],
    timelineActivity: [],
    stageHistory: [],
  } as any;

  const стан = evaluateDealHealth(aggregate);
  assert.ok(["WARNING", "RISK", "CRITICAL"].includes(стан.status));
  assert.ok(стан.signals.length > 0);
});
