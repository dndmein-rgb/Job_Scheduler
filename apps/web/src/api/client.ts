const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3010";
const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY ?? "";

type ApiOk<T> = { success: true; data: T; meta?: Record<string, unknown> };
type ApiErr = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { admin?: boolean } = {},
): Promise<T> {
  const { admin, ...init } = options;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (admin && ADMIN_KEY) headers.set("X-API-Key", ADMIN_KEY);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}
async function request<T>(
  path: string,
  init: RequestInit = {},
  admin = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (admin && ADMIN_KEY) {
    headers.set("X-API-Key", ADMIN_KEY);
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = (await res.json()) as ApiOk<T> | ApiErr;

  if (!res.ok || body.success === false) {
    const msg =
      body && "error" in body
        ? body.error.message
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return body.data;
}

export const api = {
  // public
  ready: () =>
    request<{
      status: string;
      checks: Record<string, string>;
    }>("/ready"),

  listJobs: (q: string = "") =>
    request<unknown[]>(`/jobs${q ? `?${q}` : ""}`).then(async () => {
      // list returns { data, meta } — adjust if your client only returns data
      const res = await fetch(`${BASE}/jobs${q ? `?${q}` : ""}`);
      return res.json();
    }),

  getJob: (id: string) => request<Record<string, unknown>>(`/jobs/${id}`),

  createJob: (body: unknown) =>
    request<Record<string, unknown>>("/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  cancelJob: (id: string, reason?: string) =>
    request(`/jobs/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  retryJob: (id: string) =>
    request(`/jobs/${id}/retry`, { method: "POST" }),

  listWorkers: () =>
    fetch(`${BASE}/workers`).then((r) => r.json()),

  // admin
  stats: () =>
    request<Record<string, number>>("/admin/stats", {}, true),

  deadJobs: (q: string = "") =>
    fetch(`${BASE}/admin/dead-jobs${q ? `?${q}` : ""}`, {
      headers: { "X-API-Key": ADMIN_KEY },
    }).then((r) => r.json()),

  retryDead: (id: string) =>
    request(`/admin/dead-jobs/${id}/retry`, { method: "POST" }, true),

  cancelDead: (id: string, reason?: string) =>
    request(
      `/admin/dead-jobs/${id}/cancel`,
      { method: "POST", body: JSON.stringify({ reason }) },
      true,
    ),

  queues: () =>
    request<{ queue: string; counts: Record<string, number> }>(
      "/admin/queues",
      {},
      true,
    ),

  outboxStats: () =>
    request<{ pending: number }>("/admin/outbox-stats", {}, true),
};