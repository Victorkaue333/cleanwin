import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const PADDING = { none: "", sm: "p-3", md: "p-4", lg: "p-5" } as const;

export function Card({ padding = "md", interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface shadow-card",
        interactive && "transition-colors hover:bg-surface-hover",
        PADDING[padding],
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  icon,
  title,
  aside,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text">
        {icon && <span className="text-primary [&_svg]:size-[18px]">{icon}</span>}
        <span className="truncate">{title}</span>
      </div>
      {aside && <div className="shrink-0 text-xs text-muted">{aside}</div>}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  aside,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-tight text-text">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
