import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string | number>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  value: T;
  options: SelectOption<T>[];
  onValueChange: (value: T) => void;
}

function SelectInner<T extends string | number>(
  { value, options, onValueChange, className, ...rest }: SelectProps<T>,
  ref: React.ForwardedRef<HTMLSelectElement>,
) {
  const numeric = typeof value === "number";
  return (
    <span className={cn("relative inline-flex", className)}>
      <select
        ref={ref}
        value={String(value)}
        onChange={(e) =>
          onValueChange((numeric ? Number(e.target.value) : e.target.value) as T)
        }
        className={cn(
          "h-9 w-full appearance-none rounded-button border border-border bg-surface-raised pl-3 pr-8 text-sm text-text",
          "hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50",
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} className="bg-surface text-text">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
}

export const Select = forwardRef(SelectInner) as <T extends string | number>(
  props: SelectProps<T> & { ref?: React.ForwardedRef<HTMLSelectElement> },
) => ReturnType<typeof SelectInner>;
