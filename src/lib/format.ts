// src/lib/format.ts

export function formatDate(
  value: string | Date | null | undefined,
  style: Intl.DateTimeFormatOptions["dateStyle"] = "medium",
): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { dateStyle: style });
}

export function formatDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatRelative(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (secs < 60) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function truncate(str: string | null | undefined, max = 32): string {
  if (!str) return "—";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

export function maskSecret(
  secret: string | null | undefined,
  visible = 6,
): string {
  if (!secret) return "—";
  if (secret.length <= visible) return secret;
  return (
    secret.slice(0, visible) + "•".repeat(Math.min(secret.length - visible, 12))
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
