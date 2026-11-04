import {
  BatteryCharging,
  BatteryMedium,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  RefreshCw,
  Thermometer,
} from "lucide-react";

import { HealthRow } from "@/components/shared/HealthRow";
import { MetricCard } from "@/components/shared/MetricCard";
import { NetworkCard } from "@/components/shared/NetworkCard";
import { QuickActions } from "@/components/shared/QuickActions";
import { StatChip } from "@/components/shared/StatChip";
import { StorageCard } from "@/components/shared/StorageCard";
import { TopProcessesCard } from "@/components/shared/TopProcessesCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Sparkline } from "@/components/ui/Sparkline";
import { useFormat, useT } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import { temperatureLevel } from "@/lib/thresholds";
import * as ipc from "@/services/ipc";
import { useMetricsStore } from "@/stores/metricsStore";
import { useUiStore } from "@/stores/uiStore";
import type { SystemSnapshot, ViewMode } from "@/types/ipc";

const RELEASES_URL = "https://github.com/Victorkaue333/cleanwin/releases";

export function DashboardPage({
  mode,
  onToggleMode,
}: {
  mode: ViewMode;
  onToggleMode: (next: ViewMode) => void;
}) {
  const t = useT();
  const f = useFormat();
  const { snapshot, status, error, history } = useMetricsStore();
  const appInfo = useUiStore((s) => s.appInfo);
  const compact = mode === "compact";
  const systemDisk = snapshot?.disks.find((d) => d.isSystem) ?? snapshot?.disks[0] ?? null;

  const metrics = (
    <>
      <StorageCard disk={systemDisk} />
      <div className={cn("grid grid-cols-3", compact ? "gap-2" : "gap-3")}>
        <MetricCard
          icon={<Cpu aria-hidden />}
          title={t("metrics.cpu")}
          percent={snapshot ? snapshot.cpu.usagePercent : null}
          detail={snapshot ? t("metrics.cores", { count: snapshot.cpu.logicalCores }) : null}
        />
        <MetricCard
          icon={<MemoryStick aria-hidden />}
          title={t("metrics.memory")}
          percent={snapshot ? snapshot.memory.usagePercent : null}
          detail={
            snapshot
              ? t("metrics.memoryOf", {
                  used: f.bytes(snapshot.memory.usedBytes),
                  total: f.capacity(snapshot.memory.totalBytes),
                })
              : null
          }
        />
        <MetricCard
          icon={<HardDrive aria-hidden />}
          title={t("metrics.disk")}
          percent={systemDisk ? systemDisk.usagePercent : null}
          detail={
            systemDisk ? t("metrics.diskFree", { free: f.bytes(systemDisk.availableBytes) }) : null
          }
        />
      </div>
      <ChipsRow snapshot={snapshot} />
      <NetworkCard network={snapshot?.network ?? null} />
    </>
  );

  const footer = (
    <footer className="flex items-center justify-between px-1 pt-1 text-xs text-muted">
      <span className="font-mono">{t("app.version", { version: appInfo?.version ?? "…" })}</span>
      <button
        type="button"
        onClick={() => void ipc.openExternal(RELEASES_URL)}
        className="inline-flex items-center gap-1.5 rounded-md px-1 hover:text-text"
      >
        <RefreshCw className="size-3.5" aria-hidden />
        {t("app.checkUpdates")}
      </button>
    </footer>
  );

  const errorBlock = status === "error" && !snapshot && (
    <ErrorState
      title={t("errors.metricsUnavailable")}
      details={error ?? undefined}
      retryLabel={t("actions.retry")}
      detailsLabel={t("errors.details")}
      onRetry={() => void ipc.requestMetricsRefresh()}
    />
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <HealthRow health={snapshot?.health ?? null} uptimeSecs={snapshot?.uptimeSecs ?? null} />
        {errorBlock}
        {metrics}
        <TopProcessesCard groups={snapshot?.topProcesses ?? null} limit={3} scroll />
        <QuickActions mode={mode} onToggleMode={onToggleMode} />
        {footer}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3">
      <HealthRow health={snapshot?.health ?? null} uptimeSecs={snapshot?.uptimeSecs ?? null} />
      {errorBlock}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
        <div className="flex flex-col gap-3">
          {metrics}
          <Card className="grid gap-4 sm:grid-cols-3">
            <HistoryBlock label={t("metrics.cpu")} value={snapshot ? f.percent(snapshot.cpu.usagePercent) : null} data={history.cpu} max={100} tone="primary" />
            <HistoryBlock label={t("metrics.memory")} value={snapshot ? f.percent(snapshot.memory.usagePercent) : null} data={history.memory} max={100} tone="success" />
            <HistoryBlock label={t("metrics.download")} value={snapshot ? f.rate(snapshot.network.downloadBps) : null} data={history.download} tone="warning" />
          </Card>
        </div>
        <div className="flex flex-col gap-3">
          <TopProcessesCard groups={snapshot?.topProcesses ?? null} limit={8} scroll={false} className="flex-1" />
          <QuickActions mode={mode} onToggleMode={onToggleMode} />
        </div>
      </div>
      {footer}
    </div>
  );
}

function HistoryBlock({
  label,
  value,
  data,
  max,
  tone,
}: {
  label: string;
  value: string | null;
  data: number[];
  max?: number;
  tone: "primary" | "success" | "warning";
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      <CardHeader title={label} aside={value ?? "—"} />
      <Sparkline data={data} max={max} label={`${label} - ${t("monitoring.history")}`} tone={tone} height={44} />
    </div>
  );
}

function ChipsRow({ snapshot }: { snapshot: SystemSnapshot | null }) {
  const t = useT();
  const f = useFormat();
  const gpu = snapshot?.gpu ?? null;
  const gpuValue = !snapshot
    ? null
    : snapshot.gpuStatus === "not_supported"
      ? t("metrics.notSupported")
      : gpu?.usagePercent !== null && gpu?.usagePercent !== undefined
        ? f.percent(gpu.usagePercent)
        : t("metrics.notAvailable");
  const gpuHasNumber = gpu?.usagePercent !== null && gpu?.usagePercent !== undefined;

  const temp = snapshot?.temperature.cpuC ?? gpu?.temperatureC ?? null;
  const tempValue = !snapshot
    ? null
    : temp !== null
      ? f.temperature(temp)
      : snapshot.temperature.status === "not_supported"
        ? t("metrics.notSupported")
        : t("metrics.notAvailable");

  const battery = snapshot?.battery ?? null;
  const batteryValue = !snapshot
    ? null
    : battery
      ? battery.percent !== null
        ? f.percent(battery.percent)
        : battery.onAcPower
          ? t("metrics.onAc")
          : "—"
      : t("metrics.noBattery");

  return (
    <div className="grid grid-cols-3 gap-2">
      <StatChip
        icon={<Monitor aria-hidden />}
        label={t("metrics.gpu")}
        value={gpuValue}
        meterPercent={gpuHasNumber ? (gpu?.usagePercent ?? 0) : undefined}
        muted={!gpuHasNumber}
        title={gpu?.name}
      />
      <StatChip
        icon={<Thermometer aria-hidden />}
        label={t("metrics.temp")}
        value={tempValue}
        muted={temp === null}
        meterLevel={temperatureLevel(temp)}
        title={
          snapshot?.temperature.cpuC !== null && snapshot?.temperature.cpuC !== undefined
            ? "CPU"
            : gpu?.temperatureC !== null && gpu?.temperatureC !== undefined
              ? `GPU (${gpu.temperatureSource ?? ""})`
              : undefined
        }
      />
      <StatChip
        icon={
          battery?.charging ? <BatteryCharging aria-hidden /> : <BatteryMedium aria-hidden />
        }
        label={t("metrics.battery")}
        value={batteryValue}
        muted={!battery}
        title={battery?.charging ? t("metrics.charging") : undefined}
      />
    </div>
  );
}
