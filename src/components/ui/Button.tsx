import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "cta";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-bg font-semibold hover:bg-primary-hover active:brightness-95 shadow-cta border border-transparent",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-hover active:bg-surface-raised",
  outline: "bg-transparent text-text border border-border hover:bg-surface-hover",
  ghost: "bg-transparent text-muted hover:text-text hover:bg-surface-hover border border-transparent",
  danger:
    "bg-danger-soft text-danger border border-danger/40 hover:bg-danger hover:text-text active:brightness-95",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-sm gap-2 rounded-button",
  lg: "h-10 px-4 text-sm gap-2 rounded-button",
  cta: "h-12 px-5 text-base font-bold tracking-wide uppercase gap-2.5 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    icon,
    iconRight,
    block = false,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap select-none transition-colors duration-150",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[inherit]",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
      {iconRight}
    </button>
  );
});
