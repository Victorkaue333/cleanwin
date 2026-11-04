import { HardDrive } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormat, useT } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import type { DiskMetrics } from "@/types/ipc";

/** Storage summary bar from the mockup: "Armazenamento — 162,03 GB livres de 1 TB". */
export function StorageCard({ disk, className }: { disk: DiskMetrics | null; className?: string }) {
  const t = useT();
  const f = useFormat();
  return (
    <Card padding="sm" className={cn("flex items-center gap-3 px-3.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <HardDrive className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-text">{t("metrics.storage")}</span>
          {disk ? (
            <span className="tabular truncate text-xs font-medium text-primary">
              {t("metrics.storageFree", {
                free: f.bytes(disk.availableBytes),
                total: f.capacity(disk.totalBytes),
              })}
            </span>
          ) : (
            <Skeleton className="h-3.5 w-32" />
          )}
        </div>
        <ProgressBar
          percent={disk ? disk.usagePercent : null}
          label={t("metrics.storage")}
          gradient
          size="sm"
        />
      </div>
    </Card>
  );
}
