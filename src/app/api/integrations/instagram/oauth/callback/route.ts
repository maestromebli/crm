import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import {
  getCommunicationsConfig,
  upsertCommunicationsConfig,
} from "@/lib/settings/communications-settings-store";

const STATE_COOKIE = "enver_ig_oauth_state";

type FbTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type FbPagesResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: {
      id?: string;
      username?: string;
    };
  }>;
};

function getBaseUrl(req: Request): string {
  const env = process.env.NEXTAUTH_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text || "Помилка Meta API"}`);
  }
  return (await res.json()) as T;
}

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get("code")?.trim();
  const state = reqUrl.searchParams.get("state")?.trim();
  const error = reqUrl.searchParams.get("error")?.trim();
  const baseUrl = getBaseUrl(req);
  const settingsUrl = new URL("/settings/communications", baseUrl);

  if (error) {
    settingsUrl.searchParams.set("instagramOAuth", "denied");
    settingsUrl.searchParams.set("reason", error);
    return NextResponse.redirect(settingsUrl.toString(), { status: 302 });
  }

  const decoded = (await cookies()).get(STATE_COOKIE)?.value ?? "";
  const [expectedState, expectedUserId] = decoded.split(":");
  if (!code || !state || !expectedState || !expectedUserId) {
    settingsUrl.searchParams.set("instagramOAuth", "failed");
    settingsUrl.searchParams.set("reason", "missing_oauth_params");
    const res = NextResponse.redirect(settingsUrl.toString(), { status: 302 });
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  if (state !== expectedState || expectedUserId !== user.id) {
    settingsUrl.searchParams.set("instagramOAuth", "failed");
    settingsUrl.searchParams.set("reason", "invalid_state");
    const res = NextResponse.redirect(settingsUrl.toString(), { status: 302 });
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    settingsUrl.searchParams.set("instagramOAuth", "failed");
    settingsUrl.searchParams.set("reason", "missing_app_env");
    const res = NextResponse.redirect(settingsUrl.toString(), { status: 302 });
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const redirectUri = `${baseUrl}/api/integrations/instagram/oauth/callback`;
  try {
    const tokenUrl = new URL("https://graph.facebook.com/v22.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("code", code);
    const shortToken = await fetchJson<FbTokenResponse>(tokenUrl.toString());
    const shortAccessToken = shortToken.access_token?.trim();
    if (!shortAccessToken) {
      throw new Error("Meta не повернула access token");
    }

    const exchangeUrl = new URL("https://graph.facebook.com/v22.0/oauth/access_token");
    exchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
    exchangeUrl.searchParams.set("client_id", appId);
    exchangeUrl.searchParams.set("client_secret", appSecret);
    exchangeUrl.searchParams.set("fb_exchange_token", shortAccessToken);
    const longToken = await fetchJson<FbTokenResponse>(exchangeUrl.toString());
    const userToken = longToken.access_token?.trim() || shortAccessToken;

    const pagesUrl = new URL("https://graph.facebook.com/v22.0/me/accounts");
    pagesUrl.searchParams.set("access_token", userToken);
    pagesUrl.searchParams.set(
      "fields",
      "id,name,access_token,instagram_business_account{id,username}",
    );
    const pages = await fetchJson<FbPagesResponse>(pagesUrl.toString());
    const preferred =
      pages.data?.find((p) => p.instagram_business_account?.id?.trim()) ??
      pages.data?.[0];
    const pageToken = preferred?.access_token?.trim() ?? userToken;
    const pageId = preferred?.id?.trim() ?? null;
    const igId = preferred?.instagram_business_account?.id?.trim() ?? null;
    const igUsername = preferred?.instagram_business_account?.username?.trim() ?? null;

    const current = await getCommunicationsConfig();
    await upsertCommunicationsConfig(
      {
        channels: {
          instagram: {
            ...current.channels?.instagram,
            enabled: true,
            pageId,
            instagramBusinessAccountId: igId,
            pageAccessToken: pageToken,
            notes: igUsername
              ? `Підключено через OAuth. Instagram: @${igUsername}`
              : "Підключено через OAuth.",
          },
        },
      },
      user.id,
    );

    settingsUrl.searchParams.set("instagramOAuth", "ok");
    const res = NextResponse.redirect(settingsUrl.toString(), { status: 302 });
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    settingsUrl.searchParams.set("instagramOAuth", "failed");
    settingsUrl.searchParams.set("reason", "token_exchange_failed");
    const res = NextResponse.redirect(settingsUrl.toString(), { status: 302 });
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
}
