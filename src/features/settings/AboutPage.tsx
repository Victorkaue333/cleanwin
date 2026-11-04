import { ExternalLink, FolderOpen, ShieldCheck, ShieldOff } from "lucide-react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, SectionTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormat, useT } from "@/hooks/useT";
import * as ipc from "@/services/ipc";
import { useMetricsStore } from "@/stores/metricsStore";
import { useUiStore } from "@/stores/uiStore";

export function AboutPage() {
  const t = useT();
  const f = useFormat();
  const appInfo = useUiStore((s) => s.appInfo);
  const info = useMetricsStore((s) => s.info);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <SectionTitle title={t("about.title")} />

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <BrandLogo variant="app-icon" height={64} className="rounded-2xl" />
          <div className="min-w-0">
            <BrandLogo variant="horizontal" height={32} />
            <p className="mt-1 text-sm text-muted">{t("app.tagline")}</p>
          </div>
        </div>
        <p className="text-sm text-text/90">{t("about.description")}</p>
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{t("about.license")}</Badge>
          <Badge>{t("about.builtWith")}</Badge>
          {appInfo &&
            (appInfo.elevated ? (
              <Badge tone="warning">
                <ShieldCheck className="size-3" aria-hidden /> {t("about.elevated")}
              </Badge>
            ) : (
              <Badge tone="success">
                <ShieldOff className="size-3" aria-hidden /> {t("about.notElevated")}
              </Badge>
            ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHeader title="CleanWin" />
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <Term label={t("about.version")}>{appInfo?.version ?? <Skeleton className="h-4 w-16" />}</Term>
          <Term label={t("about.identifier")}>{appInfo?.identifier ?? <Skeleton className="h-4 w-40" />}</Term>
          <Term label={t("about.configDir")}>
            <PathRow path={appInfo?.configDir} openLabel={t("actions.openFolder")} />
          </Term>
          <Term label={t("about.logDir")}>
            <PathRow path={appInfo?.logDir} openLabel={t("actions.openFolder")} />
          </Term>
          <Term label={t("about.repository")}>
            {appInfo ? (
              <Button
                size="sm"
                variant="ghost"
                className="-ml-2"
                iconRight={<ExternalLink className="size-3.5" aria-hidden />}
                onClick={() => void ipc.openExternal(appInfo.repository)}
              >
                {appInfo.repository.replace("https://", "")}
              </Button>
            ) : (
              <Skeleton className="h-4 w-48" />
            )}
          </Term>
        </dl>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHeader title={t("about.system")} />
        {info ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <Term label="Windows">{`${info.osName} ${info.osVersion}`.trim()}</Term>
            <Term label="Kernel">{info.kernelVersion || "—"}</Term>
            <Term label="Host">{info.hostName || "—"}</Term>
            <Term label={t("monitoring.processor")}>
              {info.cpuBrand} · {info.logicalCores} {t("monitoring.logicalCores").toLowerCase()}
            </Term>
            <Term label={t("metrics.memory")}>{f.capacity(info.totalMemoryBytes)}</Term>
            <Term label="Arch">{info.arch}</Term>
          </dl>
        ) : (
          <Skeleton className="h-20 w-full" />
        )}
      </Card>
    </div>
  );
}

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-all text-text">{children}</dd>
    </>
  );
}

function PathRow({ path, openLabel }: { path?: string; openLabel: string }) {
  if (!path) return <Skeleton className="h-4 w-56" />;
  return (
    <span className="flex items-center gap-2">
      <span className="truncate font-mono text-xs" title={path}>
        {path}
      </span>
      <button
        type="button"
        aria-label={openLabel}
        title={openLabel}
        onClick={() => void ipc.revealPath(path).catch(() => undefined)}
        className="shrink-0 rounded-md p-0.5 text-muted hover:text-text"
      >
        <FolderOpen className="size-4" aria-hidden />
      </button>
    </span>
  );
}
