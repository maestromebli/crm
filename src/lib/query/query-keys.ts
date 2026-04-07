type QueryScope = readonly [string];

export type EntityQueryKeys = {
  all: QueryScope;
  list: () => readonly [string, "list"];
  detail: (id: string) => readonly [string, "detail", string];
};

/**
 * Shared query-key factory for entity-level cache scopes.
 * Keeps key shape consistent across features.
 */
export function createEntityQueryKeys(scope: string): EntityQueryKeys {
  const all = [scope] as const;
  return {
    all,
    list: () => [...all, "list"] as const,
    detail: (id: string) => [...all, "detail", id] as const,
  };
}
