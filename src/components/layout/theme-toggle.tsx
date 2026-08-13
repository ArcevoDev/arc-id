"use client";

import { useEffect, useState } from "react";
import { ThemeToggle as FacetThemeToggle } from "@/providers/theme-provider";

/**
 * SSR-safe theme toggle.
 *
 * The facet ThemeToggle reads `resolvedTheme` at render time, which is
 * undefined on the server but dark on the client (default), causing a
 * hydration mismatch (server renders sun, client renders moon). Render a
 * stable placeholder until mounted so both sides agree.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        title="Toggle theme"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    );
  }

  return <FacetThemeToggle />;
}
