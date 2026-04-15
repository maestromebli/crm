import assert from "node:assert/strict";
import test from "node:test";
import {
  enforceCacheSize,
  mapWithConcurrency,
  pruneExpiredCache,
  readFreshCache,
  retryAsync,
  trimHubRailIds,
  writeCache,
  type CacheEntry,
} from "./leadHubFetch.utils";

test("trimHubRailIds returns all ids when below limit", () => {
  const result = trimHubRailIds(["a", "b"], 10);
  assert.deepEqual(result, { ids: ["a", "b"], skipped: 0 });
});

test("trimHubRailIds trims ids and reports skipped count", () => {
  const result = trimHubRailIds(["a", "b", "c", "d"], 2);
  assert.deepEqual(result, { ids: ["a", "b"], skipped: 2 });
});

test("mapWithConcurrency keeps order and respects concurrency cap", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const input = [1, 2, 3, 4, 5, 6];

  const output = await mapWithConcurrency(input, 3, async (item) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 8));
    inFlight -= 1;
    return item * 10;
  });

  assert.deepEqual(output, [10, 20, 30, 40, 50, 60]);
  assert.ok(maxInFlight <= 3);
});

test("readFreshCache returns null for missing or expired entries", () => {
  const cache = new Map<string, CacheEntry<number>>();
  assert.equal(readFreshCache(cache, "x", 100, 1_000), null);

  writeCache(cache, "x", 42, 1_000);
  assert.equal(readFreshCache(cache, "x", 100, 1_090), 42);
  assert.equal(readFreshCache(cache, "x", 100, 1_101), null);
});

test("pruneExpiredCache removes only stale entries", () => {
  const cache = new Map<string, CacheEntry<number>>();
  writeCache(cache, "fresh", 1, 1_000);
  writeCache(cache, "stale", 2, 500);

  pruneExpiredCache(cache, 600, 1_250);

  assert.equal(cache.has("fresh"), true);
  assert.equal(cache.has("stale"), false);
});

test("enforceCacheSize keeps newest entries within limit", () => {
  const cache = new Map<string, CacheEntry<number>>();
  writeCache(cache, "oldest", 1, 100);
  writeCache(cache, "middle", 2, 200);
  writeCache(cache, "newest", 3, 300);

  enforceCacheSize(cache, 2);

  assert.equal(cache.has("oldest"), false);
  assert.equal(cache.has("middle"), true);
  assert.equal(cache.has("newest"), true);
});

test("retryAsync retries on transient failure and resolves", async () => {
  let attempts = 0;
  const result = await retryAsync(
    async () => {
      attempts += 1;
      if (attempts < 2) throw new Error("temporary");
      return "ok";
    },
    { retries: 2, delayMs: 1 },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});

test("retryAsync respects shouldRetry predicate", async () => {
  let attempts = 0;
  await assert.rejects(
    retryAsync(
      async () => {
        attempts += 1;
        throw new Error("fail");
      },
      {
        retries: 3,
        delayMs: 1,
        shouldRetry: () => false,
      },
    ),
  );

  assert.equal(attempts, 1);
});
