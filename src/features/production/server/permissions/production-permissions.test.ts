import test from "node:test";
import assert from "node:assert/strict";
import { hasUnrestrictedDataScope, normalizeRole } from "../../../../lib/authz/roles";

test("normalizeRole підтримує DIRECTOR_PRODUCTION", () => {
  assert.equal(normalizeRole("DIRECTOR_PRODUCTION"), "DIRECTOR_PRODUCTION");
  assert.equal(hasUnrestrictedDataScope("DIRECTOR_PRODUCTION"), true);
});

test("legacy ADMIN як і раніше нормалізується в DIRECTOR", () => {
  assert.equal(normalizeRole("ADMIN"), "DIRECTOR");
  assert.equal(hasUnrestrictedDataScope("DIRECTOR"), true);
});

