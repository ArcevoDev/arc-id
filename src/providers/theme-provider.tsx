"use client";

import { ThemeProvider as FacetThemeProvider } from "@arcevo/facet-components/theme";

export { ThemeToggle, useTheme } from "@arcevo/facet-components/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <FacetThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem>
      {children}
    </FacetThemeProvider>
  );
}
