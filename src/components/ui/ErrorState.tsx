import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button } from "./Button";

export function ErrorState({
  title,
  message,
  details,
  onRetry,
  retryLabel = "Tentar novamente",
  detailsLabel = "Detalhes técnicos",
  className,
}: {
  title: ReactNode;
  message?: ReactNode;
  details?: string;
  onRetry?: () => void;
  retryLabel?: string;
  detailsLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2 rounded-card border border-danger/40 bg-danger-soft px-4 py-4",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-danger">
        <AlertTriangle className="size-4" aria-hidden />
        <span>{title}</span>
      </div>
      {message && <p className="text-xs text-text/90">{message}</p>}
      {details && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer select-none">{detailsLabel}</summary>
          <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px]">{details}</pre>
        </details>
      )}
      {onRetry && (
        <div>
          <Button size="sm" variant="outline" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
