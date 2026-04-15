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

export type GitLabRepositoryTreeItem = {
  id: string;
  name: string;
  type: "tree" | "blob";
  path: string;
  mode?: string;
};

export type GitLabRepositoryTreeResult =
  | {
      ok: true;
      items: GitLabRepositoryTreeItem[];
    }
  | GitLabConnectionErr;

export type GitLabFileJsonResult<T> =
  | {
      ok: true;
      data: T;
      rawText: string;
    }
  | GitLabConnectionErr;

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

function gitlabHeaders(token: string): Record<string, string> {
  return {
    "PRIVATE-TOKEN": token,
    Accept: "application/json",
  };
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
      headers: gitlabHeaders(token),
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

function encodeProjectId(projectId: string): string {
  return encodeURIComponent(projectId.trim());
}

export async function getGitLabRepositoryTree(input: {
  projectId: string;
  ref?: string | null;
  path?: string | null;
  perPage?: number;
}): Promise<GitLabRepositoryTreeResult> {
  const { baseUrl, token } = getGitLabEnv();
  if (!baseUrl || !token) {
    return {
      ok: false,
      error:
        "Задайте GITLAB_BASE_URL (наприклад https://gitlab.com) та GITLAB_TOKEN у змінних оточення сервера.",
    };
  }
  const projectId = input.projectId.trim();
  if (!projectId) {
    return { ok: false, error: "Порожній projectId для GitLab." };
  }
  const url = new URL(`${baseUrl}/api/v4/projects/${encodeProjectId(projectId)}/repository/tree`);
  if (input.ref?.trim()) url.searchParams.set("ref", input.ref.trim());
  if (input.path?.trim()) url.searchParams.set("path", input.path.trim());
  url.searchParams.set("per_page", String(Math.min(Math.max(input.perPage ?? 200, 20), 500)));

  const res = await externalGetJson<GitLabRepositoryTreeItem[]>(url.toString(), {
    headers: gitlabHeaders(token),
    cache: "no-store",
  });
  if (res.ok === false) {
    const errorText = res.text ? `: ${res.text.slice(0, 240)}` : "";
    return {
      ok: false,
      status: res.status,
      error: `GitLab tree: ${res.status}${errorText}`,
    };
  }
  return { ok: true, items: Array.isArray(res.data) ? res.data : [] };
}

export async function getGitLabRepositoryFileJson<T>(input: {
  projectId: string;
  filePath: string;
  ref?: string | null;
}): Promise<GitLabFileJsonResult<T>> {
  const { baseUrl, token } = getGitLabEnv();
  if (!baseUrl || !token) {
    return {
      ok: false,
      error:
        "Задайте GITLAB_BASE_URL (наприклад https://gitlab.com) та GITLAB_TOKEN у змінних оточення сервера.",
    };
  }
  const projectId = input.projectId.trim();
  const filePath = input.filePath.trim();
  if (!projectId || !filePath) {
    return { ok: false, error: "Порожній projectId або filePath для GitLab." };
  }

  const encodedFilePath = encodeURIComponent(filePath);
  const url = new URL(
    `${baseUrl}/api/v4/projects/${encodeProjectId(projectId)}/repository/files/${encodedFilePath}/raw`,
  );
  url.searchParams.set("ref", input.ref?.trim() || "main");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "PRIVATE-TOKEN": token,
        Accept: "application/json, text/plain",
      },
      cache: "no-store",
    });
    const rawText = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `GitLab file raw: ${response.status}${rawText ? `: ${rawText.slice(0, 240)}` : ""}`,
      };
    }
    let json: unknown = null;
    try {
      json = JSON.parse(rawText);
    } catch {
      return { ok: false, error: "Файл із GitLab не є валідним JSON." };
    }
    return { ok: true, data: json as T, rawText };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Невідома помилка";
    return { ok: false, error: msg };
  }
}
