interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variants = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700 border border-zinc-900",
  secondary: "bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-200",
  danger: "bg-red-600 text-white hover:bg-red-700 border border-red-600",
  ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 border border-transparent",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export function Button({ variant = "primary", size = "md", loading, children, disabled, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all ${variants[variant]} ${sizes[size]} ${disabled || loading ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}
