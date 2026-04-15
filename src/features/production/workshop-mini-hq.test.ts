import test from "node:test";
import assert from "node:assert/strict";
import {
  computeActiveSecondsWithNow,
  normalizeMiniHqTaskState,
  normalizeMiniHqTree,
} from "./workshop-mini-hq";

test("normalizeMiniHqTaskState: fallback до статусу задачі", () => {
  const state = normalizeMiniHqTaskState(null, "BLOCKED");
  assert.equal(state.lifecycle.state, "PAUSED");
  assert.equal(state.progress.percent, 0);
  assert.equal(state.progress.source, "none");
});

test("computeActiveSecondsWithNow додає секунди лише у RUNNING", () => {
  const seconds = computeActiveSecondsWithNow(
    {
      state: "RUNNING",
      startedAt: "2026-01-01T10:00:00.000Z",
      completedAt: null,
      lastResumedAt: "2026-01-01T10:00:30.000Z",
      lastPausedAt: null,
      activeSeconds: 120,
      pauseReasonCode: null,
      pauseComment: null,
    },
    "2026-01-01T10:02:30.000Z",
  );
  assert.equal(seconds, 240);
});

test("normalizeMiniHqTree відкидає невалідні вузли", () => {
  const nodes = normalizeMiniHqTree([
    { id: "1", parentId: null, type: "folder", name: "Main", stageKey: null },
    { id: "", parentId: null, type: "file", name: "Invalid" },
    { id: "2", parentId: "1", type: "file", name: "cutting.csv", stageKey: "CUTTING" },
  ]);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[1].stageKey, "CUTTING");
});

