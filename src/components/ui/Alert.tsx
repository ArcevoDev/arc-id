interface AlertProps { children: React.ReactNode; variant?: "info" | "success" | "warning" | "error"; title?: string; }
const styles = {
  info:    "bg-blue-50  border-blue-200  text-blue-800",
  success: "bg-green-50 border-green-200 text-green-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  error:   "bg-red-50   border-red-200   text-red-800",
};
const icons = { info: "ℹ️", success: "✅", warning: "⚠️", error: "❌" };
export function Alert({ children, variant = "info", title }: AlertProps) {
  return (
    <div className={`rounded-lg border p-4 ${styles[variant]}`}>
      <div className="flex gap-3">
        <span>{icons[variant]}</span>
        <div>
          {title && <p className="font-semibold text-sm mb-1">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
