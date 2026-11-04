import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/cn";
import { useToastStore, type Toast } from "@/stores/toastStore";

const ICON = {
  success: <CheckCircle2 className="size-4 text-success" aria-hidden />,
  info: <Info className="size-4 text-primary" aria-hidden />,
  warning: <AlertTriangle className="size-4 text-warning" aria-hidden />,
  danger: <XCircle className="size-4 text-danger" aria-hidden />,
} as const;

const BORDER = {
  success: "border-success/40",
  info: "border-border",
  warning: "border-warning/40",
  danger: "border-danger/40",
} as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, toast.durationMs);
    return () => window.clearTimeout(t);
  }, [toast.durationMs, onDismiss]);

  return (
    <div
      role={toast.kind === "danger" || toast.kind === "warning" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-surface p-3 shadow-xl",
        "animate-[cw-toast-in_180ms_ease-out]",
        BORDER[toast.kind],
      )}
    >
      <span className="mt-0.5 shrink-0">{ICON[toast.kind]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted break-words">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar"
        className="shrink-0 rounded-md p-0.5 text-muted hover:text-text"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
