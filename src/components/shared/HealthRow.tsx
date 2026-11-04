import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useFormat, useT, useTDynamic } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import type { HealthStatus } from "@/types/ipc";

const DOT = {
  healthy: "bg-success shadow-[0_0_0_4px_var(--color-success-soft)]",
  attention: "bg-warning shadow-[0_0_0_4px_var(--color-warning-soft)]",
  critical: "bg-danger shadow-[0_0_0_4px_var(--color-danger-soft)]",
} as const;

/** "● Sistema saudável ............ UP 5H 23M" */
export function HealthRow({
  health,
  uptimeSecs,
  className,
}: {
  health: HealthStatus | null;
  uptimeSecs: number | null;
  className?: string;
}) {
  const t = useT();
  const td = useTDynamic();
  const f = useFormat();

  if (!health) {
    return (
      <div className={cn("flex h-7 items-center justify-between", className)}>
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 rounded-full bg-track" aria-hidden />
          <span className="text-sm text-muted">{t("health.loading")}</span>
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  const label = t(`health.${health.level}`);
  const reasons = health.reasons.map((r) => td(`health.reasons.${r}`, r)).join(" · ");
  const status = (
    <div className="flex items-center gap-2.5" role="status">
      <span className={cn("size-2.5 shrink-0 rounded-full", DOT[health.level])} aria-hidden />
      <span className="text-sm font-medium text-text">{label}</span>
    </div>
  );

  return (
    <div className={cn("flex h-7 items-center justify-between gap-3", className)}>
      {reasons ? <Tooltip content={reasons}>{status}</Tooltip> : status}
      {uptimeSecs !== null && (
        <span className="tabular text-xs font-medium uppercase tracking-wide text-muted">
          {t("health.uptime", { uptime: f.uptimeShort(uptimeSecs) })}
        </span>
      )}
    </div>
  );
}
