"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Code2, LogOut, Loader2, Menu, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getCurrentUser, logout } from "@/lib/auth";
import {
  getUniversityTheme,
  buildThemeStyle,
  type UniversityTheme,
} from "@/lib/university-theme";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface UniversityLayoutProps {
  navItems: NavItem[];
  children: React.ReactNode;
}

function SidebarContent({
  theme,
  navItems,
  pathname,
  collapsed,
  onNavigate,
}: {
  theme: UniversityTheme | null;
  navItems: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* University branding */}
      <div className={`flex items-center gap-3 py-5 ${collapsed ? "justify-center px-2" : "px-6"}`}>
        {theme?.logo_url ? (
          <Image
            src={theme.logo_url}
            alt={theme.name}
            width={36}
            height={36}
            className="rounded shrink-0"
            style={{ width: "auto", height: "auto" }}
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10 text-primary font-bold text-lg shrink-0">
            {theme?.name?.charAt(0) || "U"}
          </div>
        )}
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight truncate">
            {theme?.name || "University"}
          </span>
        )}
      </div>
      <Separator />

      {/* Navigation */}
      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? "px-2" : "px-4"}`}>
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          const btn = (
            <Button
              key={item.href}
              asChild
              variant={active ? "secondary" : "ghost"}
              size={collapsed ? "icon" : "default"}
              className={collapsed ? "w-full" : "w-full justify-start gap-3"}
              onClick={onNavigate}
            >
              <Link href={item.href}>
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && item.label}
              </Link>
            </Button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return btn;
        })}
      </nav>

      {/* Footer area */}
      <Separator />
      <div className={`py-3 flex items-center ${collapsed ? "flex-col gap-2 px-2" : "justify-between px-4"}`}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign Out</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        )}
        <ThemeToggle />
      </div>
      {!collapsed && (
        <div className="px-4 pb-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <Code2 className="h-3 w-3" />
            Powered by AcademicFBI
          </Link>
        </div>
      )}
    </>
  );
}

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`border-b py-2 ${collapsed ? "px-2" : "px-4"}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={
              collapsed
                ? "w-full"
                : "w-full justify-start gap-2 text-muted-foreground"
            }
            onClick={onToggle}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                Collapse
              </>
            )}
          </Button>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent side="right">Expand sidebar</TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}

export function UniversityLayout({ navItems, children }: UniversityLayoutProps) {
  const pathname = usePathname();
  const [theme, setTheme] = React.useState<UniversityTheme | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const user = getCurrentUser();
    if (user?.university_slug) {
      getUniversityTheme(user.university_slug)
        .then(setTheme)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const themeStyle = React.useMemo(() => buildThemeStyle(theme), [theme]);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden university-theme" style={themeStyle}>
        {/* Desktop sidebar — fixed full height, never scrolls */}
        <aside
          className={`hidden md:flex border-r bg-background flex-col shrink-0 h-screen sticky top-0 overflow-hidden transition-all duration-200 ${
            collapsed ? "w-[60px]" : "w-64"
          }`}
        >
          <CollapseToggle
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
          />
          <SidebarContent
            theme={theme}
            navItems={navItems}
            pathname={pathname}
            collapsed={collapsed}
          />
        </aside>

        {/* Mobile header + scrollable main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="md:hidden flex items-center justify-between border-b bg-background px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              {theme?.logo_url ? (
                <Image
                  src={theme.logo_url}
                  alt={theme.name}
                  width={28}
                  height={28}
                  className="rounded"
                  style={{ width: "auto", height: "auto" }}
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary font-bold text-sm">
                  {theme?.name?.charAt(0) || "U"}
                </div>
              )}
              <span className="font-bold truncate">
                {theme?.name || "University"}
              </span>
            </div>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarContent
                  theme={theme}
                  navItems={navItems}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </header>

          {/* Main content — only this area scrolls vertically */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
