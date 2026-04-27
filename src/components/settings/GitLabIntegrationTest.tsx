"use client";

import { IntegrationConnectionTest } from "./IntegrationConnectionTest";

export function GitLabIntegrationTest() {
  return (
    <IntegrationConnectionTest
      endpoint="/api/integrations/gitlab"
      formatSuccessMessage={(payload) => {
        const data = payload as typeof payload & {
          baseUrl?: string;
          gitlabVersion?: string;
          user?: { username?: string; name?: string };
        };
        return `З’єднання OK · GitLab ${data.gitlabVersion ?? "unknown"} · користувач @${data.user?.username ?? "unknown"} (${data.user?.name ?? "unknown"}) · ${data.baseUrl ?? "n/a"}`;
      }}
    />
  );
}
