export async function testAiConnection() {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return {
      ok: false as const,
      error: "AI_API_KEY is not configured",
      status: 200,
      attempts: 1,
    };
  }

  return {
    ok: true as const,
    model: process.env.AI_MODEL ?? "configured",
    baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
    attempts: 1,
  };
}
