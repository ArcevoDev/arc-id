// src/components/arc/cards/auth-card.tsx
import { Alert } from "@/components/ui/alert";
import { Icons } from "@/lib/ui/icon-registry";

interface AuthCardProps {
  title: string;
  description?: string;
  error?: string | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({
  title,
  description,
  error,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="text-sm flex items-start gap-2">
          <Icons.alertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </Alert>
      )}

      {children}

      {/* Footer */}
      {footer && (
        <p className="text-center text-sm text-muted-foreground">{footer}</p>
      )}
    </div>
  );
}
