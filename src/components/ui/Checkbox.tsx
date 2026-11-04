import { Check } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, ...rest },
  ref,
) {
  return (
    <span className={cn("relative inline-flex size-5 shrink-0 items-center justify-center", className)}>
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        className={cn(
          "peer size-5 cursor-pointer appearance-none rounded-md border border-border bg-track transition-colors",
          "checked:border-primary checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
        )}
        {...rest}
      />
      <Check
        aria-hidden
        className="pointer-events-none absolute size-3.5 text-bg opacity-0 peer-checked:opacity-100"
        strokeWidth={3}
      />
    </span>
  );
});
