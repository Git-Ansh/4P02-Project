import { NextRequest, NextResponse } from "next/server";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

const ROLE_ROUTES: Record<string, string[]> = {
  super_admin: ["/super-admin"],
  admin: ["/admin"],
  instructor: ["/instructor"],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth needed
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/about" ||
    pathname.startsWith("/submit") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  const payload = token ? decodeJwtPayload(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const role = payload.role as string;

  // Check if user's role is allowed for this route
  for (const [allowedRole, prefixes] of Object.entries(ROLE_ROUTES)) {
    for (const prefix of prefixes) {
      if (pathname.startsWith(prefix) && role !== allowedRole) {
        // Redirect to their own dashboard
        const dashPrefixes = ROLE_ROUTES[role];
        const dest = dashPrefixes ? dashPrefixes[0] : "/";
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
