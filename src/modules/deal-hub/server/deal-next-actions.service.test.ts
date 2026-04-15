import test from "node:test";
import assert from "node:assert/strict";
import { buildDealNextActions } from "./deal-next-actions.service";

test("next actions include pricing approval when no approved estimate", () => {
  const aggregate = {
    deal: {
      stage: { slug: "pricing" },
      estimates: [{ version: 2, status: "DRAFT" }],
      contract: null,
      paymentMilestones: [],
      productionFlow: null,
      installationDate: null,
      workspaceMeta: {},
    },
    openTasks: [],
  } as any;

  const actions = buildDealNextActions(aggregate, { role: "SALES_MANAGER" });
  assert.ok(actions.some((item) => item.id === "approve-pricing"));
});
