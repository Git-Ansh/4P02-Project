import { apiFetch } from "./api";

interface LoginParams {
  email: string;
  password: string;
  university_slug?: string;
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
  exp: number;
}

export async function login(params: LoginParams): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(params),
  });

  localStorage.setItem("token", data.access_token);
  document.cookie = `token=${data.access_token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;

  return data;
}

export function logout() {
  localStorage.removeItem("token");
  document.cookie = "token=; path=/; max-age=0";
  window.location.href = "/";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

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
