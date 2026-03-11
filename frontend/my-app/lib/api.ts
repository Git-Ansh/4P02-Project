const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8888";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  // Only set Content-Type for requests with a body
  if (options.body) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || "Request failed");
  }

  if (res.status === 204) return null as T;
  return res.json();
}

// Types
export interface University {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo_url?: string;
  status: string;
  created_at: string;
}

// Public API functions
export async function getUniversities(): Promise<University[]> {
  return apiFetch<University[]>("/api/universities");
}
