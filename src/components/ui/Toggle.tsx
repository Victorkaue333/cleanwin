import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/** Accessible switch (role="switch") with label and optional description. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  loading,
  className,
}: ToggleProps) {
  const id = useId();
  const descId = useId();
  const isDisabled = disabled || loading;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-text">
          {label}
        </label>
        {description && (
          <p id={descId} className="mt-0.5 text-xs leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? descId : undefined}
        aria-busy={loading || undefined}
        disabled={isDisabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-primary bg-primary" : "border-border bg-track",
          isDisabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block size-4 rounded-full bg-text shadow transition-transform",
            checked ? "translate-x-[1.45rem]" : "translate-x-[0.2rem]",
          )}
        />
      </button>
    </div>
  );
}
