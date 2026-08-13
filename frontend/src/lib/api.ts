import { getApiUrl } from "./format";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const TOKEN_KEY = "expocraft.accessToken";
export const REFRESH_KEY = "expocraft.refreshToken";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setTokens(accessToken: string | null, refreshToken?: string | null) {
  if (typeof window === "undefined") return;
  if (accessToken) window.localStorage.setItem(TOKEN_KEY, accessToken);
  else window.localStorage.removeItem(TOKEN_KEY);
  if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
  else if (refreshToken === null) window.localStorage.removeItem(REFRESH_KEY);
}

function buildQuery(query?: Record<string, string | number | boolean | null | undefined>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  token?: string | null;
  /** Server component-д кэш хийхгүй байх */
  cache?: RequestCache;
  signal?: AbortSignal;
};

type RefreshResponse = { accessToken: string; refreshToken: string };

/** Сессээ алдсаныг UI-д мэдэгдэх дохио — auth context үүнийг сонсоно. */
export const SIGNED_OUT_EVENT = "expocraft:signed-out";

/**
 * Зэрэг явж буй хүсэлтүүд нэг дор 401 авбал refresh нэг л удаа явахыг хангана.
 * Эс бөгөөс хэд хэдэн refresh зэрэг явж, токеныг ротацлаад бие биенээ хүчингүй болгоно.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = window.localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      const rotated = await request<RefreshResponse>("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
        token: null,
      });
      setTokens(rotated.accessToken, rotated.refreshToken);
      return true;
    } catch {
      // Refresh token нь ч хүчингүй болсон — сессийг цэвэрлэж, UI-д мэдэгдэнэ.
      setTokens(null, null);
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
      return false;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = "GET", body, query, cache = "no-store", signal } = options;
  const token = options.token !== undefined ? options.token : getToken();

  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  // Backend нь cookie-той mutating хүсэлтэд CSRF header шаарддаг.
  if (method !== "GET") headers["x-csrf-token"] = "expocraft-web";

  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache,
      credentials: "omit",
      signal,
    });
  } catch {
    throw new ApiError(0, "network_error", "Сервертэй холбогдож чадсангүй. / Cannot reach the server.");
  }

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    const err = (payload as any)?.error || {};

    /*
     * Access token 15 минутын хугацаатай. Дуусахад алдаа шидэхийн оронд refresh
     * token-оор нэг удаа сэргээж, хүсэлтийг чимээгүй давтана.
     *   • `isRetry` — нэг л удаа оролдоно, давталтад орохгүй.
     *   • `options.token !== undefined` — токен зориудаар зааж өгсөн хүсэлт
     *     (`/auth/*`, серверийн нийтийн дуудлага) энд орохгүй.
     */
    const canRetry =
      response.status === 401 &&
      !isRetry &&
      options.token === undefined &&
      typeof window !== "undefined";

    if (canRetry && (await refreshAccessToken())) {
      return request<T>(path, options, true);
    }

    throw new ApiError(response.status, err.code || "http_error", err.message || response.statusText, err.details);
  }
  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T,>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T,>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body: body ?? {} }),
  patch: <T,>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body: body ?? {} }),
  del: <T,>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

/** Server component-үүдэд ашиглах: алдаа гарвал null буцаана. */
export async function serverGet<T>(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>
): Promise<T | null> {
  try {
    return await request<T>(path, { method: "GET", query, token: null, cache: "no-store" });
  } catch {
    return null;
  }
}

/**
 * Зураг байршуулах (multipart). Backend: POST /uploads/images — seller/admin эрхтэй.
 * FormData тул `request()`-ийг ашиглахгүй, гэхдээ токен сэргээх зан төлөв ижил.
 */
export async function uploadImage(file: File, isRetry = false): Promise<string> {
  const token = getToken();
  const body = new FormData();
  body.append("file", file);

  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/uploads/images`, {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-csrf-token": "expocraft-web",
    },
    body,
    credentials: "omit",
  });

  const text = await response.text();
  const payload = text ? (safeParse(text) as any) : null;
  if (!response.ok) {
    if (response.status === 401 && !isRetry && (await refreshAccessToken())) {
      return uploadImage(file, true);
    }
    throw new ApiError(response.status, payload?.error?.code || "upload_failed", payload?.error?.message || "Upload failed.");
  }

  const url = payload?.upload?.url as string | undefined;
  if (!url) throw new ApiError(500, "upload_failed", "Upload did not return a URL.");
  return url.startsWith("http") ? url : `${apiUrl}${url}`;
}

export function errorMessage(error: unknown, fallback = "Алдаа гарлаа / Something went wrong"): string {
  if (error instanceof ApiError) {
    if (error.code === "bad_credentials") return "Имэйл эсвэл нууц үг буруу байна.";
    if (error.code === "too_many_attempts") return "Олон удаа буруу оролдлоо. Түр хүлээгээд дахин оролдоно уу.";
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
