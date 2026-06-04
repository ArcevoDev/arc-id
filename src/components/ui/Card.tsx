interface CardProps { children: React.ReactNode; className?: string; }
export function Card({ children, className = "" }: CardProps) {
  return <div className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = "" }: CardProps) {
  return <div className={`px-6 py-4 border-b border-zinc-100 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = "" }: CardProps) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: CardProps) {
  return <div className={`px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 rounded-b-xl ${className}`}>{children}</div>;
}
