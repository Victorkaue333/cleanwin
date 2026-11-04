import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

import { Button, type ButtonVariant } from "./Button";

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  /** Primary action. */
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm?: () => void;
  confirmLoading?: boolean;
  confirmDisabled?: boolean;
  cancelLabel?: string;
  tone?: "default" | "danger";
  size?: "sm" | "md" | "lg";
  /** Prevent closing via Esc / backdrop while an operation runs. */
  locked?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Accessible modal: focus trap, Esc to close, restores focus, labelled by title. */
export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  confirmLabel,
  confirmVariant,
  onConfirm,
  confirmLoading,
  confirmDisabled,
  cancelLabel = "Cancelar",
  tone = "default",
  size = "md",
  locked = false,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [];
    const first = focusables[focusables.length - 1 - (onConfirm ? 1 : 0)] ?? focusables[0];
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (!firstItem || !lastItem) return;
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose, locked, onConfirm]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "w-full rounded-card border border-border bg-surface p-5 shadow-2xl outline-none",
          "animate-[cw-fade-in_160ms_ease-out]",
          size === "sm" && "max-w-sm",
          size === "md" && "max-w-md",
          size === "lg" && "max-w-2xl",
        )}
      >
        <h2
          id={titleId}
          className={cn("text-base font-bold", tone === "danger" ? "text-danger" : "text-text")}
        >
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-1.5 text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={locked}>
            {cancelLabel}
          </Button>
          {onConfirm && confirmLabel && (
            <Button
              variant={confirmVariant ?? (tone === "danger" ? "danger" : "primary")}
              onClick={onConfirm}
              loading={confirmLoading}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
