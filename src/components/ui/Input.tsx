interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = "", id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-zinc-700">{label}</label>}
      <input
        id={inputId}
        {...props}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all 
          ${error ? "border-red-400 focus:ring-1 focus:ring-red-400" : "border-zinc-200 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"}
          ${className}`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
