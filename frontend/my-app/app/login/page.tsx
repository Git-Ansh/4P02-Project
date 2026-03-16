"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Code2, Loader2, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { login, getCurrentUser, getDashboardPath } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  getUniversityTheme,
  buildThemeStyle,
  type UniversityTheme,
} from "@/lib/university-theme";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const universitySlug = searchParams.get("university") || searchParams.get("slug") || "";
  const preselectedRole = searchParams.get("role") || "";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [theme, setTheme] = React.useState<UniversityTheme | null>(null);
  const tokenCleared = React.useRef(false);

  // Clear any existing session once on mount when arriving from role selection,
  // so the user can log in as a different role. Only auto-redirect if visiting
  // /login directly with no params and already logged in.
  React.useEffect(() => {
    if ((universitySlug || preselectedRole) && !tokenCleared.current) {
      tokenCleared.current = true;
      localStorage.removeItem("token");
      document.cookie = "token=; path=/; max-age=0";
      return;
    }
    if (!universitySlug && !preselectedRole) {
      const user = getCurrentUser();
      if (user) {
        router.replace(getDashboardPath(user.role));
      }
    }
  }, [router, universitySlug, preselectedRole]);

  // Fetch university theme for branding
  React.useEffect(() => {
    if (universitySlug) {
      getUniversityTheme(universitySlug).then(setTheme);
    }
  }, [universitySlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login({
        email,
        password,
        university_slug: universitySlug || undefined,
      });
      console.log("Login response:", { role: data.role, university_slug: data.university_slug });
      console.log("Redirecting to:", getDashboardPath(data.role));
      router.push(getDashboardPath(data.role));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const roleLabel =
    preselectedRole === "admin"
      ? "Administrator"
      : preselectedRole === "instructor"
        ? "Instructor"
        : "";

  // CSS variable overrides for university theme (works in both light & dark)
  const themeStyle = React.useMemo(() => buildThemeStyle(theme), [theme]);

  // Apply theme vars to <body> so any portals/dialogs also inherit the theme
  React.useEffect(() => {
    const entries = Object.entries(themeStyle);
    if (entries.length === 0) return;
    for (const [key, value] of entries) {
      document.body.style.setProperty(key, value as string);
    }
    document.body.classList.add("university-theme");
    return () => {
      for (const [key] of entries) {
        document.body.style.removeProperty(key);
      }
      document.body.classList.remove("university-theme");
    };
  }, [themeStyle]);

  const isUniLogin = !!universitySlug;

  return (
    <div className={`min-h-screen flex flex-col${isUniLogin ? " university-theme" : ""}`} style={themeStyle}>
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {isUniLogin && theme ? (
              /* University branding */
              <div className="flex flex-col items-center gap-3 mb-4">
                {theme.logo_url ? (
                  <Image
                    src={theme.logo_url}
                    alt={theme.name}
                    width={64}
                    height={64}
                    className="rounded"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-2xl">
                    {theme.name.charAt(0)}
                  </div>
                )}
                <span className="text-xl font-bold tracking-tight">
                  {theme.name}
                </span>
              </div>
            ) : (
              /* AcademicFBI branding (super admin login) */
              <Link
                href="/"
                className="flex items-center justify-center gap-2 mb-4"
              >
                <Code2 className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold tracking-tight">
                  ACADEMIC<span className="text-primary">FBI</span>
                </span>
              </Link>
            )}
            <CardTitle className="text-2xl">
              {isUniLogin ? `${roleLabel} Sign In` : "Platform Sign In"}
            </CardTitle>
            <CardDescription>
              {isUniLogin
                ? `Sign in as ${roleLabel.toLowerCase()}`
                : "Sign in with your super admin credentials"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link href="/" className="text-primary hover:underline">
                Back to home
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Footer — shows AcademicFBI branding on university login pages */}
      {isUniLogin && (
        <footer className="py-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <Code2 className="h-3 w-3" />
            Powered by AcademicFBI
          </Link>
        </footer>
      )}
    </div>
  );
}
