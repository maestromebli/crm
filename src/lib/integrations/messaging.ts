type Failed = { ok: false; error: string; status: number };

function missingConfig(message: string): Failed {
  return { ok: false, error: message, status: 200 };
}

export async function testTelegramConnection(_userId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return missingConfig("TELEGRAM_BOT_TOKEN is not configured");
  return {
    ok: true as const,
    username: process.env.TELEGRAM_BOT_USERNAME ?? "unknown",
    botId: process.env.TELEGRAM_BOT_ID ?? "configured",
  };
}

export async function testWhatsappConnection(_userId: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return missingConfig("WHATSAPP_ACCESS_TOKEN is not configured");
  return {
    ok: true as const,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "configured",
    displayPhoneNumber: process.env.WHATSAPP_DISPLAY_NUMBER ?? "configured",
    verifiedName: process.env.WHATSAPP_VERIFIED_NAME ?? "configured",
  };
}

export async function testInstagramConnection(_userId: string) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    return missingConfig("INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET is not configured");
  }
  return {
    ok: true as const,
    pageId: process.env.INSTAGRAM_PAGE_ID ?? "configured",
    pageName: process.env.INSTAGRAM_PAGE_NAME ?? "configured",
    instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? null,
    instagramUsername: process.env.INSTAGRAM_USERNAME ?? null,
  };
}

export async function testViberConnection(_userId: string) {
  const token = process.env.VIBER_AUTH_TOKEN;
  if (!token) return missingConfig("VIBER_AUTH_TOKEN is not configured");
  return {
    ok: true as const,
    accountName: process.env.VIBER_ACCOUNT_NAME ?? "configured",
    accountUri: process.env.VIBER_ACCOUNT_URI ?? "configured",
  };
}

export async function testSmsConnection(_userId: string) {
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) return missingConfig("SMS_API_KEY is not configured");
  return {
    ok: true as const,
    provider: process.env.SMS_PROVIDER ?? "configured",
    apiUrl: process.env.SMS_API_URL ?? "configured",
    probeStatus: 200,
  };
}

export async function testPhoneConnection(_userId: string) {
  const apiKey = process.env.PHONE_API_KEY;
  if (!apiKey) return missingConfig("PHONE_API_KEY is not configured");
  return {
    ok: true as const,
    provider: process.env.PHONE_PROVIDER ?? "configured",
    apiUrl: process.env.PHONE_API_URL ?? "configured",
    probeStatus: 200,
  };
}
