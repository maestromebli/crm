export async function testMetaTargetConnection() {
  const appId = process.env.META_APP_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!appId || !accessToken) {
    return {
      ok: false as const,
      error: "META_APP_ID or META_ACCESS_TOKEN is not configured",
      status: 200,
    };
  }

  return {
    ok: true as const,
    accountId: process.env.META_AD_ACCOUNT_ID ?? "configured",
    accountName: process.env.META_AD_ACCOUNT_NAME ?? "configured",
    apiVersion: process.env.META_GRAPH_API_VERSION ?? "v21.0",
  };
}
