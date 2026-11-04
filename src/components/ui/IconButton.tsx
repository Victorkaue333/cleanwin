import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  size?: "sm" | "md";
  tone?: "default" | "danger";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = "md", tone = "default", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-muted transition-colors",
        "hover:text-text hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed",
        tone === "danger" && "hover:bg-danger hover:text-text",
        size === "sm" ? "size-7 [&_svg]:size-4" : "size-8 [&_svg]:size-[18px]",
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
