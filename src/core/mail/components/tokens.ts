/**
 * ArcID mail design tokens.
 * Shared across all components — change here, changes everywhere.
 */
export const tokens = {
  color: {
    bg: "#ffffff",
    bgMuted: "#f9fafb",
    bgDark: "#111827",
    border: "#e5e7eb",
    text: "#111827",
    textMuted: "#6b7280",
    textLight: "#9ca3af",
    textInverse: "#ffffff",
    primary: "#000000",
    primaryHover: "#1f2937",
    danger: "#dc2626",
    dangerBg: "#fef2f2",
    warning: "#d97706",
    warningBg: "#fffbeb",
    success: "#16a34a",
    successBg: "#f0fdf4",
    link: "#2563eb",
  },
  font: {
    family:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
    sizeXs: "12px",
    sizeSm: "14px",
    sizeMd: "16px",
    sizeLg: "20px",
    sizeXl: "24px",
  },
  radius: {
    sm: "4px",
    md: "6px",
    lg: "8px",
  },
  space: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    xxl: "48px",
  },
  maxWidth: "600px",
} as const;
