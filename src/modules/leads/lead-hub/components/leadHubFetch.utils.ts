export function trimHubRailIds(
  ids: string[],
  maxItems: number,
): { ids: string[]; skipped: number } {
  const safeLimit = Math.max(1, Math.floor(maxItems));
  if (ids.length <= safeLimit) {
    return { ids, skipped: 0 };
  }
  return {
    ids: ids.slice(0, safeLimit),
    skipped: ids.length - safeLimit,
  };
}

export type CacheEntry<T> = {
  value: T;
  cachedAt: number;
};

export function readFreshCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  ttlMs: number,
  nowMs = Date.now(),
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (nowMs - entry.cachedAt > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  nowMs = Date.now(),
): void {
  cache.set(key, { value, cachedAt: nowMs });
}

export function pruneExpiredCache<T>(
  cache: Map<string, CacheEntry<T>>,
  ttlMs: number,
  nowMs = Date.now(),
): void {
  cache.forEach((entry, key) => {
    if (nowMs - entry.cachedAt > ttlMs) {
      cache.delete(key);
    }
  });
}

export function enforceCacheSize<T>(
  cache: Map<string, CacheEntry<T>>,
  maxEntries: number,
): void {
  const safeMaxEntries = Math.max(1, Math.floor(maxEntries));
  const overflow = cache.size - safeMaxEntries;
  if (overflow <= 0) return;

  const oldestKeys = Array.from(cache.entries())
    .sort((a, b) => a[1].cachedAt - b[1].cachedAt)
    .slice(0, overflow)
    .map(([key]) => key);

  for (const key of oldestKeys) {
    cache.delete(key);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RetryAsyncOptions = {
  retries: number;
  delayMs: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

export async function retryAsync<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryAsyncOptions,
): Promise<T> {
  const retries = Math.max(0, Math.floor(options.retries));
  const delayMs = Math.max(0, Math.floor(options.delayMs));
  let attempt = 0;

  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      const shouldRetry = options.shouldRetry ? options.shouldRetry(error, attempt) : true;
      if (!shouldRetry || attempt >= retries) {
        throw error;
      }
      const backoffMs = delayMs * (attempt + 1);
      if (backoffMs > 0) {
        await wait(backoffMs);
      }
      attempt += 1;
    }
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(safeConcurrency, items.length) }, () => runWorker()),
  );

  return results;
}
