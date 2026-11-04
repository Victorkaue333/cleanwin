import {
  ArrowDown,
  ArrowUp,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Thermometer,
  Wifi,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, SectionTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SegmentedMeter } from "@/components/ui/SegmentedMeter";
import { Skeleton } from "@/components/ui/Skeleton";
import { Sparkline } from "@/components/ui/Sparkline";
import { useFormat, useT } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import { LEVEL_TEXT, temperatureLevel, usageLevel } from "@/lib/thresholds";
import * as ipc from "@/services/ipc";
import { useMetricsStore } from "@/stores/metricsStore";
import { useSettingsStore } from "@/stores/settingsStore";

export function MonitoringPage() {
  const t = useT();
  const f = useFormat();
  const { snapshot, history, info, status, error } = useMetricsStore();
  const interval = useSettingsStore((s) => s.settings.refreshIntervalMs);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3">
      <SectionTitle
        title={t("monitoring.title")}
        subtitle={t("monitoring.subtitle", { interval: f.duration(interval) })}
        aside={
          snapshot && (
            <Badge tone="neutral">{t("metrics.processes", { count: snapshot.processCount })}</Badge>
          )
        }
      />

      {status === "error" && !snapshot && (
        <ErrorState
          title={t("errors.metricsUnavailable")}
          details={error ?? undefined}
          retryLabel={t("actions.retry")}
          detailsLabel={t("errors.details")}
          onRetry={() => void ipc.requestMetricsRefresh()}
        />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {/* CPU */}
        <Card className="flex flex-col gap-3">
          <CardHeader
            icon={<Cpu />}
            title={t("metrics.cpu")}
            aside={info?.cpuBrand ?? snapshot?.cpu.brand}
          />
          {snapshot ? (
            <>
              <div className="flex items-end justify-between">
                <span
                  className={cn(
                    "tabular text-3xl font-bold leading-none",
                    LEVEL_TEXT[usageLevel(snapshot.cpu.usagePercent)],
                  )}
                >
                  {f.percent(snapshot.cpu.usagePercent)}
                </span>
                <dl className="grid grid-cols-3 gap-x-4 text-right text-xs">
                  <Stat label={t("monitoring.logicalCores")} value={String(snapshot.cpu.logicalCores)} />
                  <Stat
                    label={t("monitoring.physicalCores")}
                    value={snapshot.cpu.physicalCores?.toString() ?? "—"}
                  />
                  <Stat label={t("monitoring.frequency")} value={f.frequency(snapshot.cpu.frequencyMhz)} />
                </dl>
              </div>
              <Sparkline data={history.cpu} max={100} label={t("monitoring.history")} />
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">{t("monitoring.perCore")}</p>
                <div className="grid grid-cols-4 gap-x-3 gap-y-2 sm:grid-cols-6">
                  {snapshot.cpu.perCore.map((v, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="tabular w-5 text-[10px] text-muted">{i}</span>
                      <SegmentedMeter percent={v} segments={8} size="sm" label={`CPU ${i}`} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <LoadingBlock />
          )}
        </Card>

        {/* Memory */}
        <Card className="flex flex-col gap-3">
          <CardHeader icon={<MemoryStick />} title={t("metrics.memory")} />
          {snapshot ? (
            <>
              <div className="flex items-end justify-between">
                <span
                  className={cn(
                    "tabular text-3xl font-bold leading-none",
                    LEVEL_TEXT[usageLevel(snapshot.memory.usagePercent)],
                  )}
                >
                  {f.percent(snapshot.memory.usagePercent)}
                </span>
                <dl className="grid grid-cols-3 gap-x-4 text-right text-xs">
                  <Stat label={t("monitoring.memoryUsed")} value={f.bytes(snapshot.memory.usedBytes)} />
                  <Stat
                    label={t("monitoring.memoryAvailable")}
                    value={f.bytes(snapshot.memory.availableBytes)}
                  />
                  <Stat label={t("monitoring.memoryTotal")} value={f.capacity(snapshot.memory.totalBytes)} />
                </dl>
              </div>
              <Sparkline data={history.memory} max={100} label={t("monitoring.history")} tone="success" />
              <ProgressBar percent={snapshot.memory.usagePercent} label={t("metrics.memory")} />
              {snapshot.memory.swapTotalBytes > 0 && (
                <p className="tabular text-xs text-muted">
                  {t("monitoring.swap")}: {f.bytes(snapshot.memory.swapUsedBytes)} /{" "}
                  {f.capacity(snapshot.memory.swapTotalBytes)}
                </p>
              )}
            </>
          ) : (
            <LoadingBlock />
          )}
        </Card>

        {/* Storage */}
        <Card className="flex flex-col gap-3">
          <CardHeader icon={<HardDrive />} title={t("monitoring.drives")} />
          {snapshot ? (
            snapshot.disks.length === 0 ? (
              <EmptyState title={t("metrics.notAvailable")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {snapshot.disks.map((d) => (
                  <li key={d.mountPoint} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-semibold text-text">{d.mountPoint}</span>
                        {d.name && <span className="truncate text-muted">{d.name}</span>}
                        {d.isSystem && <Badge tone="primary">{t("monitoring.systemDrive")}</Badge>}
                        {d.isRemovable && <Badge>{t("monitoring.removable")}</Badge>}
                        <Badge>{d.fileSystem}</Badge>
                        <Badge>{d.kind}</Badge>
                      </span>
                      <span className={cn("tabular shrink-0 font-semibold", LEVEL_TEXT[usageLevel(d.usagePercent)])}>
                        {f.percent(d.usagePercent)}
                      </span>
                    </div>
                    <ProgressBar percent={d.usagePercent} label={d.mountPoint} size="sm" />
                    <p className="tabular text-xs text-muted">
                      {t("monitoring.used")} {f.bytes(d.usedBytes)} · {t("monitoring.free")}{" "}
                      {f.bytes(d.availableBytes)} · {t("monitoring.capacity")} {f.capacity(d.totalBytes)}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <LoadingBlock />
          )}
        </Card>

        {/* GPU + sensors */}
        <Card className="flex flex-col gap-3">
          <CardHeader icon={<Monitor />} title={t("metrics.gpu")} />
          {snapshot ? (
            snapshot.gpuStatus === "not_supported" ? (
              <EmptyState title={t("metrics.notSupported")} description={t("monitoring.gpuUnsupported")} />
            ) : snapshot.gpus.length === 0 ? (
              <EmptyState title={t("metrics.notAvailable")} description={t("monitoring.noGpu")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {snapshot.gpus.map((g) => (
                  <li key={g.name} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-text">{g.name}</span>
                      {g.vendor && <Badge>{g.vendor}</Badge>}
                    </div>
                    <dl className="grid grid-cols-3 gap-x-4 text-xs">
                      <Stat
                        label={t("monitoring.gpuUsage")}
                        value={g.usagePercent === null ? t("metrics.notAvailable") : f.percent(g.usagePercent)}
                        left
                      />
                      <Stat
                        label={t("monitoring.vram")}
                        value={
                          g.memoryTotalBytes
                            ? `${f.bytes(g.memoryUsedBytes ?? 0)} / ${f.capacity(g.memoryTotalBytes)}`
                            : t("metrics.notAvailable")
                        }
                        left
                      />
                      <Stat
                        label={t("monitoring.gpuTemp")}
                        value={g.temperatureC === null ? t("metrics.notAvailable") : f.temperature(g.temperatureC)}
                        left
                      />
                    </dl>
                    {g.usagePercent !== null && (
                      <ProgressBar percent={g.usagePercent} label={g.name} size="sm" />
                    )}
                  </li>
                ))}
                {snapshot.gpu?.usagePercent !== null && snapshot.gpu?.usagePercent !== undefined && (
                  <Sparkline data={history.gpu} max={100} label={t("monitoring.history")} tone="warning" />
                )}
              </ul>
            )
          ) : (
            <LoadingBlock />
          )}
          <div className="border-t border-border pt-3">
            <CardHeader icon={<Thermometer />} title={t("monitoring.sensors")} />
            {snapshot ? (
              snapshot.temperature.sensors.length === 0 ? (
                <p className="mt-2 text-xs text-muted">{t("monitoring.noSensors")}</p>
              ) : (
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {snapshot.temperature.sensors.map((s) => (
                    <li key={s.label} className="flex justify-between gap-2">
                      <span className="truncate text-muted">{s.label}</span>
                      <span className={cn("tabular font-semibold", LEVEL_TEXT[temperatureLevel(s.valueC)])}>
                        {f.temperature(s.valueC)}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <Skeleton className="mt-2 h-4 w-40" />
            )}
          </div>
        </Card>

        {/* Network */}
        <Card className="flex flex-col gap-3 md:col-span-2">
          <CardHeader
            icon={<Wifi />}
            title={t("metrics.network")}
            aside={
              snapshot && snapshot.network.connected !== null && (
                <Badge tone={snapshot.network.connected ? "success" : "danger"}>
                  {snapshot.network.connected ? t("monitoring.connected") : t("monitoring.disconnected")}
                </Badge>
              )
            }
          />
          {snapshot ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <ArrowDown className="size-4 text-success" aria-hidden />
                  <span className="text-muted">{t("metrics.download")}</span>
                  <span className="tabular ml-auto font-semibold text-text">
                    {f.rate(snapshot.network.downloadBps)}
                  </span>
                </div>
                <Sparkline data={history.download} label={t("metrics.download")} tone="success" />
                <p className="tabular text-xs text-muted">
                  {t("monitoring.totalReceived")}: {f.bytes(snapshot.network.totalReceivedBytes)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <ArrowUp className="size-4 text-primary" aria-hidden />
                  <span className="text-muted">{t("metrics.upload")}</span>
                  <span className="tabular ml-auto font-semibold text-text">
                    {f.rate(snapshot.network.uploadBps)}
                  </span>
                </div>
                <Sparkline data={history.upload} label={t("metrics.upload")} tone="primary" />
                <p className="tabular text-xs text-muted">
                  {t("monitoring.totalSent")}: {f.bytes(snapshot.network.totalTransmittedBytes)}
                </p>
              </div>
              {snapshot.network.interfaces.length > 0 && (
                <ul className="md:col-span-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  {snapshot.network.interfaces.map((i) => (
                    <li key={i.name} className="flex justify-between gap-2">
                      <span className="truncate text-muted">{i.name}</span>
                      <span className="tabular shrink-0 text-text">
                        ↓ {f.rate(i.downloadBps)} · ↑ {f.rate(i.uploadBps)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <LoadingBlock />
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, left }: { label: string; value: string; left?: boolean }) {
  return (
    <div className={cn("min-w-0", left ? "text-left" : "text-right")}>
      <dt className="truncate text-[11px] text-muted">{label}</dt>
      <dd className="tabular truncate font-semibold text-text">{value}</dd>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}
