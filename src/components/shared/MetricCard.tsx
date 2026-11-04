import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { SegmentedMeter } from "@/components/ui/SegmentedMeter";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormat, useT } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import { LEVEL_TEXT, usageLevel } from "@/lib/thresholds";

export interface MetricCardProps {
  icon: ReactNode;
  title: string;
  percent: number | null;
  /** Secondary line, e.g. "12 núcleos" or "15,95 GB de 24 GB". */
  detail: string | null;
  className?: string;
}

/** CPU / Memória / Disco card from the mockup: big percentage + 10-segment meter. */
export function MetricCard({ icon, title, percent, detail, className }: MetricCardProps) {
  const t = useT();
  const f = useFormat();
  const level = usageLevel(percent);
  const loading = percent === null;
  return (
    <Card padding="sm" className={cn("flex flex-col gap-2 px-3.5 py-3", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <span className="text-text [&_svg]:size-[18px]">{icon}</span>
        <span className="truncate">{title}</span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "tabular text-[1.75rem] font-bold leading-none tracking-tight",
              level === "ok" ? "text-text" : LEVEL_TEXT[level],
            )}
          >
            {f.percent(percent)}
          </span>
          {level !== "ok" && (
            <span className={cn("text-[11px] font-semibold uppercase", LEVEL_TEXT[level])}>
              {t(`level.${level}`)}
            </span>
          )}
        </div>
      )}
      <SegmentedMeter percent={percent} label={title} size="sm" />
      {detail === null ? (
        <Skeleton className="h-3 w-24" />
      ) : (
        <span className="tabular truncate text-xs text-muted">{detail}</span>
      )}
    </Card>
  );
}
