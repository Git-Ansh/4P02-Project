/**
 * @file university-theme.ts
 * Utilities for fetching and applying per-university brand themes.
 *
 * Each university can configure a `primary_color` and `secondary_color`
 * (hex strings) via the admin panel.  These are applied as CSS custom
 * property overrides on the student submission portal so the UI matches
 * the institution's branding (logo, button colours, accent colours).
 *
 * Theme results are cached in a module-level object so that navigating
 * between pages of the same university does not trigger repeated API calls.
 */

import { apiFetch } from "./api";

export interface UniversityTheme {
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

// Cache to avoid refetching on every page navigation
const cache: Record<string, UniversityTheme> = {};

/**
 * Fetch the theme for a university by slug.
 * Results are cached for the lifetime of the page session.
 * Returns `null` if the slug is unknown or the request fails.
 */
export async function getUniversityTheme(
  slug: string,
): Promise<UniversityTheme | null> {
  if (cache[slug]) return cache[slug];
  try {
    const theme = await apiFetch<UniversityTheme>(
      `/api/universities/${slug}/theme`,
    );
    cache[slug] = theme;
    return theme;
  } catch {
    return null;
  }
}

/**
 * Convert a hex color like "#CC0000" to HSL string "0 100% 40%"
 * needed for shadcn/ui CSS variables.
 */
export function hexToHsl(hex: string): string {
  hex = hex.trim();
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return `0 0% ${Math.round(l * 100)}%`;

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Build CSS variable overrides from a university theme so the
 * primary/accent/ring colors match the university brand in both
 * light and dark modes.
 */
export function buildThemeStyle(
  theme: UniversityTheme | null,
): React.CSSProperties {
  if (!theme?.primary_color) return {};
  const hsl = hexToHsl(theme.primary_color);
  // Use white foreground for dark brand colors, black for light ones
  const fg = isColorDark(theme.primary_color) ? "0 0% 100%" : "0 0% 0%";
  return {
    "--primary": hsl,
    "--primary-foreground": fg,
    "--accent": hsl,
    "--accent-foreground": fg,
    "--ring": hsl,
    // Neutralise borders so the app's neon cyan doesn't leak through
    "--border": "0 0% 90%",
    "--input": "0 0% 90%",
    // Override the Tron theme custom properties
    "--tron-primary": theme.primary_color!,
    "--tron-primary-glow": `${theme.primary_color!}80`,
    "--tron-secondary": theme.secondary_color || theme.primary_color!,
    "--tron-border": `${theme.primary_color!}33`,
  } as React.CSSProperties;
}

/** Returns true when the perceived luminance of a hex color is below 50%. */
function isColorDark(hex: string): boolean {
  hex = hex.trim();
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // Relative luminance (sRGB)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.5;
}
