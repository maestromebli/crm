export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-role": "manager",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const contractsApi = {
  getContract: (id: string) => request(`/contracts/${id}`),
  updateContract: (id: string, payload: unknown) =>
    request(`/contracts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  generateDocuments: (id: string) => request(`/contracts/${id}/generate-documents`, { method: "POST" }),
  sendForReview: (id: string) => request(`/contracts/${id}/send-for-review`, { method: "POST" }),
  approve: (id: string) => request(`/contracts/${id}/approve`, { method: "POST" }),
  share: (id: string, payload: { expiresInHours?: number; maxViews?: number }) =>
    request(`/contracts/${id}/share`, { method: "POST", body: JSON.stringify(payload) }),
  getPortal: (token: string) => request(`/portal/contracts/${token}`),
  markViewed: (token: string) => request(`/portal/contracts/${token}/viewed`, { method: "POST" }),
  signPortal: (token: string) => request(`/portal/contracts/${token}/sign`, { method: "POST" })
};
