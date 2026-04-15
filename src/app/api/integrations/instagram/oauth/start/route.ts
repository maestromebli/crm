import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

const STATE_COOKIE = "enver_ig_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;

function getBaseUrl(req: Request): string {
  const env = process.env.NEXTAUTH_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const baseUrl = getBaseUrl(req);
  const settingsUrl = new URL("/settings/communications", baseUrl);
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  if (!appId) {
    settingsUrl.searchParams.set("instagramOAuth", "failed");
    settingsUrl.searchParams.set("reason", "missing_app_env");
    return NextResponse.redirect(settingsUrl.toString(), { status: 302 });
  }

  const redirectUri = `${baseUrl}/api/integrations/instagram/oauth/callback`;
  const state = randomBytes(24).toString("hex");
  const scope = [
    "instagram_basic",
    "instagram_manage_messages",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "business_management",
  ].join(",");

  const authUrl = new URL("https://www.facebook.com/v22.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);

  const res = NextResponse.redirect(authUrl.toString(), { status: 302 });
  const isSecure = baseUrl.startsWith("https://");
  res.cookies.set({
    name: STATE_COOKIE,
    value: `${state}:${user.id}`,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}
