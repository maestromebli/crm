import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

const DEFAULT_QUERY_OPTIONS: NonNullable<QueryClientConfig["defaultOptions"]> = {
  queries: {
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
};

export function createCrmQueryClient(
  config?: QueryClientConfig,
): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...DEFAULT_QUERY_OPTIONS,
      ...config?.defaultOptions,
      queries: {
        ...DEFAULT_QUERY_OPTIONS.queries,
        ...config?.defaultOptions?.queries,
      },
      mutations: {
        ...config?.defaultOptions?.mutations,
      },
    },
  });
}
