import type { EmailBrand } from "@arcevo/facet-emails";

/** ArcID mail color palette — used for inline styles on custom sections. */
export const MAIL_COLOR = {
  bg: "#ffffff",
  bgMuted: "#f9fafb",
  border: "#e5e7eb",
  text: "#111827",
  textMuted: "#6b7280",
  textLight: "#9ca3af",
  primary: "#000000",
  primaryHover: "#1f2937",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  warning: "#d97706",
  warningBg: "#fffbeb",
  success: "#16a34a",
  successBg: "#f0fdf4",
  link: "#2563eb",
} as const;

/** ArcID mail typography tokens. */
export const MAIL_FONT = {
  family:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono:
    "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
  sizeXs: "12px",
  sizeSm: "14px",
  sizeMd: "16px",
  sizeLg: "20px",
  sizeXl: "24px",
} as const;

/** ArcID mail spacing tokens. */
export const MAIL_SPACE = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
} as const;

/** ArcID mail radius tokens. */
export const MAIL_RADIUS = {
  sm: "4px",
  md: "6px",
  lg: "8px",
} as const;

/** Maximum email body width. */
export const MAIL_MAX_WIDTH = "600px";

/** Default footer note for ArcID emails. */
export const DEFAULT_MAIL_FOOTER_NOTE =
  "This message was sent by ArcID, the sovereign identity engine. " +
  "You are receiving it because this address is connected to an ArcID account.";

/** Default footer meta (copyright) for ArcID emails. */
export const DEFAULT_MAIL_FOOTER_META = `© ${new Date().getFullYear()} ArcID. All rights reserved.`;

/**
 * ArcID email brand configuration.
 *
 * facet-emails components reference colors via CSS variables
 * (`var(--primary, …)`, `var(--surface, …)` etc.).  Those variables are
 * **never** set by `renderEmail` itself — only a few brand options leak
 * into the `<style>` block (link colors, heading colors, hr borders).
 * `ARCID_EMAIL_CSS_VARS` below is injected into every rendered document so
 * that the component-level `var(--…)` references resolve to the correct
 * ArcID palette.  Without it buttons render in facet's default purple
 * instead of ArcID black.
 */
export const ARCID_EMAIL_BRAND: EmailBrand = {
  primary: MAIL_COLOR.primary,
  background: MAIL_COLOR.bgMuted,
  surface: MAIL_COLOR.bg,
  text: MAIL_COLOR.text,
  muted: MAIL_COLOR.textMuted,
  fontFamily: MAIL_FONT.family,
  radius: 8,
  brandName: "ArcID",
};

/** CSS-injected `:root` block that powers the facet-emails CSS variables. */
export const ARCID_EMAIL_CSS_VARS = `:root {
  --primary: ${MAIL_COLOR.primary};
  --surface: ${MAIL_COLOR.bg};
  --text: ${MAIL_COLOR.text};
  --muted: ${MAIL_COLOR.textMuted};
  --background: ${MAIL_COLOR.bgMuted};
  --danger: ${MAIL_COLOR.danger};
}`;

/**
 * Inject ArcID CSS variables into a rendered email's `<style>` block.
 * Safe to call multiple times — only injects once.
 */
export function injectEmailCssVars(html: string): string {
  if (html.includes("--primary")) return html;
  return html.replace("</style>", `${ARCID_EMAIL_CSS_VARS}</style>`);
}
