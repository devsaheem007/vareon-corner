/**
 * Tiny fetch wrapper for the Vareon API.
 *  - cookies carry the session (httpOnly, never readable from JS)
 *  - every call sends X-Requested-With (server-side CSRF guard)
 *  - an expired access token is transparently refreshed once, single-flight
 */
export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];
  code?: string; // machine-readable, e.g. "EMAIL_NOT_VERIFIED"
  constructor(status: number, message: string, details?: { field: string; message: string }[], code?: string) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;
const NO_REFRESH = new Set(["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout", "/auth/verify-email", "/auth/resend-code", "/auth/forgot-password", "/auth/reset-password", "/auth/google"]);
let refreshing: Promise<boolean> | null = null;

function send(method: string, path: string, body?: unknown, signal?: AbortSignal) {
  const headers: Record<string, string> = { "X-Requested-With": "XMLHttpRequest" };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return fetch(BASE + path, { method, headers, body: payload, credentials: "include", signal });
}

function refreshSession() {
  refreshing ??= send("POST", "/auth/refresh")
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res = await send(method, path, body, signal);
  if (res.status === 401 && !NO_REFRESH.has(path) && (await refreshSession())) {
    res = await send(method, path, body, signal);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) throw new ApiError(res.status, data?.message ?? res.statusText ?? "Request failed", data?.details, data?.code);
  return data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  /** Downloads a protected file (e.g. CSV export) through the authenticated session. */
  async download(path: string, filename: string) {
    let res = await send("GET", path);
    if (res.status === 401 && (await refreshSession())) res = await send("GET", path);
    if (!res.ok) throw new ApiError(res.status, "Download failed");
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const errorMessage = (e: unknown) =>
  e instanceof ApiError
    ? e.details?.[0]
      ? `${e.message}: ${e.details[0].message}`
      : e.message
    : "Network error - please try again";
