import type { ReactNode } from "react";

import { SegmentedMeter } from "@/components/ui/SegmentedMeter";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import type { UsageLevel } from "@/lib/thresholds";

export interface StatChipProps {
  icon: ReactNode;
  label: string;
  /** Right-hand value; `null` shows a skeleton. */
  value: string | null;
  /** Optional small meter between label and value (GPU chip in the mockup). */
  meterPercent?: number | null;
  meterLevel?: UsageLevel;
  muted?: boolean;
  title?: string;
  className?: string;
}

/** Small horizontal stat: "GPU ▮▮▮▯▯ 38%", "Temp. 56°C", "Bateria 73%". */
export function StatChip({
  icon,
  label,
  value,
  meterPercent,
  meterLevel,
  muted,
  title,
  className,
}: StatChipProps) {
  return (
    <div
      title={title}
      className={cn(
        "flex h-10 min-w-0 items-center gap-2 rounded-chip border border-border bg-surface px-3",
        className,
      )}
    >
      <span className="shrink-0 text-text [&_svg]:size-4">{icon}</span>
      <span className="shrink-0 text-xs font-medium text-muted">{label}</span>
      {meterPercent !== undefined && (
        <SegmentedMeter
          percent={meterPercent}
          segments={6}
          size="sm"
          label={label}
          level={meterLevel}
          className="w-14 flex-none"
        />
      )}
      <span className="ml-auto min-w-0 truncate text-right">
        {value === null ? (
          <Skeleton className="ml-auto h-3.5 w-10" />
        ) : (
          <span className={cn("tabular text-sm font-semibold", muted ? "text-muted" : "text-text")}>
            {value}
          </span>
        )}
      </span>
    </div>
  );
}
