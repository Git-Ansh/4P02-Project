/**
 * @file api.ts
 * Centralised HTTP client for all backend API calls.
 *
 * All requests are routed through `apiFetch`, which:
 * - Prepends the configured API base URL (`NEXT_PUBLIC_API_URL` env var,
 *   falling back to `http://127.0.0.1:8000` for local development).
 * - Attaches the JWT Bearer token from `localStorage` when present.
 * - Sets `Content-Type: application/json` automatically for non-FormData bodies.
 * - Throws `ApiError` for non-2xx responses, surfacing the backend `detail` message.
 * - Redirects to `/` and clears the stored token on 401 Unauthorized responses.
 * - Returns `null` for 204 No Content responses.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/**
 * Typed error thrown by `apiFetch` for non-2xx HTTP responses.
 * `status` carries the HTTP status code; `message` carries the backend `detail` string.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Read the JWT access token from localStorage. Returns null on the server (SSR). */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/**
 * Generic authenticated fetch wrapper.
 *
 * @template T - Expected response body type.
 * @param path - API path relative to the base URL (e.g. `"/api/instructor/courses"`).
 * @param options - Standard `RequestInit` options (method, body, headers, etc.).
 * @returns Parsed JSON response body typed as `T`, or `null` for 204 responses.
 * @throws {ApiError} For any non-2xx response.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  // Only set Content-Type for non-FormData bodies (browser sets it for FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/";
      return null as T;
    }
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || "Request failed");
  }

  if (res.status === 204) return null as T;
  return res.json();
}

/** University record returned by `GET /api/universities`. */
export interface University {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo_url?: string;
  status: string;
  created_at: string;
}

/** Fetch all active universities. Used by the student submission portal institution picker. */
export async function getUniversities(): Promise<University[]> {
  return apiFetch<University[]>("/api/universities");
}