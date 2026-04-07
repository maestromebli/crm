/**
 * Перевірка з’єднання з GitLab REST API (серверні змінні оточення).
 * Документація: https://docs.gitlab.com/ee/api/
 */
import { externalGetJson } from "../api/external-json";

export type GitLabConnectionOk = {
  ok: true;
  gitlabVersion: string;
  user: { id: number; username: string; name: string };
  baseUrl: string;
};

export type GitLabConnectionErr = {
  ok: false;
  error: string;
  status?: number;
};

export type GitLabConnectionResult = GitLabConnectionOk | GitLabConnectionErr;

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

export function getGitLabEnv(): { baseUrl: string | null; token: string | null } {
  const baseUrl = process.env.GITLAB_BASE_URL?.trim()
    ? normalizeBaseUrl(process.env.GITLAB_BASE_URL.trim())
    : null;
  const token = process.env.GITLAB_TOKEN?.trim() || null;
  return { baseUrl, token };
}

/** GET /api/v4/user — перевірка токена та доступності інстансу. */
export async function testGitLabConnection(): Promise<GitLabConnectionResult> {
  const { baseUrl, token } = getGitLabEnv();
  if (!baseUrl || !token) {
    return {
      ok: false,
      error:
        "Задайте GITLAB_BASE_URL (наприклад https://gitlab.com) та GITLAB_TOKEN у змінних оточення сервера.",
    };
  }

  try {
    const commonInit: RequestInit = {
      headers: {
        "PRIVATE-TOKEN": token,
        Accept: "application/json",
      },
      cache: "no-store",
    };
    const userRes = await externalGetJson<{
      id?: number;
      username?: string;
      name?: string;
    }>(`${baseUrl}/api/v4/user`, commonInit);

    if (userRes.ok === false) {
      return {
        ok: false,
        status: userRes.status,
        error:
          userRes.status === 401
            ? "Недійсний або прострочений токен (401)."
            : `GitLab відповів ${userRes.status}${userRes.text ? `: ${userRes.text.slice(0, 200)}` : ""}`,
      };
    }
    const user = userRes.data;
    const versionRes = await externalGetJson<{ version?: string }>(
      `${baseUrl}/api/v4/version`,
      commonInit,
    );
    let gitlabVersion = "unknown";
    if (versionRes.ok && versionRes.data?.version) {
      gitlabVersion = versionRes.data.version;
    }

    return {
      ok: true,
      baseUrl,
      gitlabVersion,
      user: {
        id: user.id ?? 0,
        username: user.username ?? "",
        name: user.name ?? "",
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Невідома помилка";
    return { ok: false, error: msg };
  }
}
