import { cn } from "@/lib/cn";
import { LEVEL_BG, usageLevel, type UsageLevel } from "@/lib/thresholds";

export interface ProgressBarProps {
  /** 0–100; `null` shows an indeterminate bar. */
  percent: number | null;
  label: string;
  level?: UsageLevel | "accent";
  size?: "sm" | "md";
  className?: string;
  /** Gradient from primary to warning, as in the mockup storage bar. */
  gradient?: boolean;
}

export function ProgressBar({
  percent,
  label,
  level,
  size = "md",
  className,
  gradient,
}: ProgressBarProps) {
  const indeterminate = percent === null;
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, percent));
  const resolved = level ?? usageLevel(percent);
  const fill =
    resolved === "accent"
      ? "bg-primary"
      : gradient
        ? "bg-[linear-gradient(90deg,var(--color-primary),var(--color-warning))]"
        : LEVEL_BG[resolved];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      className={cn(
        "w-full overflow-hidden rounded-full bg-track",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
    >
      {indeterminate ? (
        <div
          className={cn(
            "h-full w-1/3 rounded-full bg-primary",
            "animate-[cw-shimmer_1.2s_linear_infinite] bg-[length:200%_100%]",
          )}
          style={{
            backgroundImage:
              "linear-gradient(90deg, transparent, var(--color-primary), transparent)",
          }}
        />
      ) : (
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", fill)}
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}
