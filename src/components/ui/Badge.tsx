interface BadgeProps { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info"; }
const variants = {
  default: "bg-zinc-100 text-zinc-700",
  success: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};
export function Badge({ children, variant = "default" }: BadgeProps) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}>{children}</span>;
}
