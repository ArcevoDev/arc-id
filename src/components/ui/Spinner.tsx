export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  return <div className={`${s[size]} border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin`} />;
}
