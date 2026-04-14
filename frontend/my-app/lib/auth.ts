/**
 * @file auth.ts
 * Client-side authentication utilities: login, logout, token storage, and
 * current-user extraction.
 *
 * Token storage strategy
 * ----------------------
 * The JWT access token is stored in two places simultaneously:
 *   - `localStorage["token"]`  — read by `apiFetch` for API calls.
 *   - A session cookie (`token`) — read by the Next.js middleware for
 *     server-side route protection (middleware cannot access localStorage).
 *
 * The cookie is set with `SameSite=Lax` and a 24-hour `max-age` matching the
 * server-side token expiry.  It is NOT `HttpOnly` because middleware runs in
 * the Edge runtime and reads `request.cookies`, while the actual API calls
 * use the localStorage copy.
 */

import { apiFetch } from "./api";

interface LoginParams {
  email: string;
  password: string;
  university_slug?: string;
  role?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  university_slug?: string;
}

export interface User {
  sub: string;
  role: string;
  university_slug?: string;
  full_name?: string;
  exp: number;
}

/**
 * Authenticate with the backend and persist the returned JWT.
 * Stores the token in both `localStorage` and a browser cookie.
 * @throws {ApiError} If credentials are invalid (401) or another API error occurs.
 */
export async function login(params: LoginParams): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(params),
  });

  localStorage.setItem("token", data.access_token);
  document.cookie = `token=${data.access_token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;

  return data;
}

/** Clear the stored token from both localStorage and the cookie, then redirect to `/`. */
export function logout() {
  localStorage.removeItem("token");
  document.cookie = "token=; path=/; max-age=0";
  window.location.href = "/";
}

/** Read the raw JWT string from localStorage. Returns `null` during SSR. */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/**
 * Decode the stored JWT and return the payload as a `User` object.
 * Returns `null` if no token is present, the token is malformed, or it has expired.
 * Automatically calls `logout()` when an expired token is detected.
 */
export function getCurrentUser(): User | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp * 1000 < Date.now()) {
      logout();
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Map a user role string to its home dashboard path.
 * Used after login to redirect the user to the correct section of the app.
 */
export function getDashboardPath(role: string): string {
  switch (role) {
    case "super_admin":
      return "/super-admin";
    case "admin":
      return "/admin";
    case "instructor":
      return "/instructor";
    default:
      return "/";
  }
}
