import { cn } from "@/lib/cn";
import { LEVEL_BG, litSegments, usageLevel, type UsageLevel } from "@/lib/thresholds";

export interface SegmentedMeterProps {
  /** 0–100. `null` renders an empty meter. */
  percent: number | null | undefined;
  segments?: number;
  /** Override the level (e.g. for temperature). */
  level?: UsageLevel;
  size?: "sm" | "md";
  label: string;
  className?: string;
}

/** Ten-cell utilisation indicator, as in the reference mockup. */
export function SegmentedMeter({
  percent,
  segments = 10,
  level,
  size = "md",
  label,
  className,
}: SegmentedMeterProps) {
  const lit = litSegments(percent, segments);
  const resolved = level ?? usageLevel(percent);
  const value = percent === null || percent === undefined ? undefined : Math.round(percent);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={value === undefined ? undefined : `${value}%`}
      data-level={resolved}
      data-lit={lit}
      className={cn("flex w-full gap-[3px]", className)}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          data-testid="meter-segment"
          data-lit={i < lit ? "true" : "false"}
          className={cn(
            "flex-1 rounded-[2px] transition-colors duration-300",
            size === "sm" ? "h-2" : "h-2.5",
            i < lit ? LEVEL_BG[resolved] : "bg-track",
          )}
        />
      ))}
    </div>
  );
}
