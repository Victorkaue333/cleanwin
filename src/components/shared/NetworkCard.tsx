import { ArrowDown, ArrowUp, Wifi, WifiOff } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormat, useT } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import type { NetworkMetrics } from "@/types/ipc";

/** "Rede  ↓ 230 kB/s  ↑ 772 kB/s" */
export function NetworkCard({
  network,
  className,
}: {
  network: NetworkMetrics | null;
  className?: string;
}) {
  const t = useT();
  const f = useFormat();
  const offline = network?.connected === false;
  return (
    <Card padding="sm" className={cn("flex h-11 items-center gap-3 px-3.5", className)}>
      <span className={cn("shrink-0", offline ? "text-danger" : "text-success")}>
        {offline ? <WifiOff className="size-4" aria-hidden /> : <Wifi className="size-4" aria-hidden />}
      </span>
      <span className="text-sm font-medium text-text">{t("metrics.network")}</span>
      {offline && <span className="text-xs text-danger">{t("metrics.offline")}</span>}
      <div className="ml-auto flex items-center gap-5">
        <Rate
          icon={<ArrowDown className="size-4 text-success" aria-hidden />}
          label={t("metrics.download")}
          value={network ? f.rate(network.downloadBps) : null}
        />
        <Rate
          icon={<ArrowUp className="size-4 text-primary" aria-hidden />}
          label={t("metrics.upload")}
          value={network ? f.rate(network.uploadBps) : null}
        />
      </div>
    </Card>
  );
}

function Rate({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <span className="flex items-center gap-1.5" aria-label={label}>
      {icon}
      {value === null ? (
        <Skeleton className="h-3.5 w-14" />
      ) : (
        <span className="tabular min-w-[4.5rem] text-sm font-semibold text-text">{value}</span>
      )}
    </span>
  );
}
