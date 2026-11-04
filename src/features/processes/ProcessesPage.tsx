import { ArrowDown, ArrowUp, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { stripExe } from "@/components/shared/TopProcessesCard";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useErrorMessage } from "@/hooks/useErrorMessage";
import { useFormat, useT, useTDynamic } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import { filterProcesses, sortProcesses, type ProcessSortKey } from "@/lib/processes";
import { LEVEL_TEXT, usageLevel } from "@/lib/thresholds";
import { useMetricsStore } from "@/stores/metricsStore";
import { useProcessesStore } from "@/stores/processesStore";
import { toast } from "@/stores/toastStore";
import type { ProcessInfo } from "@/types/ipc";

const COLUMNS: { key: ProcessSortKey; label: "processes.name" | "processes.pid" | "processes.cpu" | "processes.memory"; align: "left" | "right" }[] = [
  { key: "name", label: "processes.name", align: "left" },
  { key: "pid", label: "processes.pid", align: "right" },
  { key: "cpuPercent", label: "processes.cpu", align: "right" },
  { key: "memoryBytes", label: "processes.memory", align: "right" },
];

export function ProcessesPage() {
  const t = useT();
  const td = useTDynamic();
  const f = useFormat();
  const describe = useErrorMessage();
  const store = useProcessesStore();
  // Derived in the component: a selector returning a fresh array would break useSyncExternalStore.
  const visible = useMemo(
    () => sortProcesses(filterProcesses(store.list, store.query), store.sort),
    [store.list, store.query, store.sort],
  );
  const lastUpdate = useMetricsStore((s) => s.lastUpdateMs);
  const [target, setTarget] = useState<ProcessInfo | null>(null);

  // Refresh on mount and every time the backend pushes a new snapshot while this page is open.
  useEffect(() => {
    void store.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdate]);

  async function confirmKill() {
    if (!target) return;
    const name = stripExe(target.name);
    try {
      await store.kill(target.pid);
      toast.success(t("processes.killed", { name }));
    } catch (error) {
      const { title, detail } = describe(error);
      toast.danger(title, detail);
    } finally {
      setTarget(null);
    }
  }

  const killing = target ? store.killing.includes(target.pid) : false;

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-3">
      <SectionTitle
        title={t("processes.title")}
        subtitle={t("processes.subtitle", { count: f.integer(store.list.length) })}
        aside={
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="size-4" aria-hidden />}
            onClick={() => void store.refresh()}
            loading={store.loading && store.loaded}
          >
            {t("actions.refresh")}
          </Button>
        }
      />

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={store.query}
          onChange={(e) => store.setQuery(e.target.value)}
          placeholder={t("processes.search")}
          aria-label={t("processes.search")}
          className="h-9 w-full rounded-button border border-border bg-surface pl-9 pr-9 text-sm text-text placeholder:text-muted"
        />
        {store.query && (
          <button
            type="button"
            onClick={() => store.setQuery("")}
            aria-label={t("actions.close")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-text"
          >
            <X className="size-4" />
          </button>
        )}
      </label>

      {store.error && !store.loaded && (
        <ErrorState
          title={describe(store.error).title}
          details={store.error.message}
          retryLabel={t("actions.retry")}
          detailsLabel={t("errors.details")}
          onRetry={() => void store.refresh()}
        />
      )}

      <Card padding="none" className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface-raised text-xs text-muted">
              <tr>
                {COLUMNS.map((c) => {
                  const active = store.sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (store.sort.direction === "asc" ? "ascending" : "descending") : "none"}
                      className={cn(
                        "px-3 py-2 font-medium",
                        c.align === "right" ? "text-right" : "text-left",
                        c.key === "name" && "w-[46%]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => store.sortBy(c.key)}
                        aria-label={t("processes.sortBy", { column: t(c.label) })}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md hover:text-text",
                          active && "text-text",
                        )}
                      >
                        {t(c.label)}
                        {active &&
                          (store.sort.direction === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden />
                          ))}
                      </button>
                    </th>
                  );
                })}
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("processes.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {!store.loaded &&
                Array.from({ length: 12 }, (_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-3 py-2"><Skeleton className="ml-auto h-4 w-10" /></td>
                    <td className="px-3 py-2"><Skeleton className="ml-auto h-4 w-10" /></td>
                    <td className="px-3 py-2"><Skeleton className="ml-auto h-4 w-16" /></td>
                    <td className="px-3 py-2"><Skeleton className="ml-auto h-6 w-16" /></td>
                  </tr>
                ))}
              {store.loaded && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6">
                    <EmptyState title={t("processes.empty")} />
                  </td>
                </tr>
              )}
              {visible.map((p) => (
                <tr key={p.pid} className="border-t border-border hover:bg-surface-hover">
                  <td className="max-w-0 px-3 py-1.5">
                    <div className="truncate font-medium text-text" title={p.exe ?? p.name}>
                      {p.name}
                    </div>
                    {p.exe && <div className="truncate text-[11px] text-muted">{p.exe}</div>}
                  </td>
                  <td className="tabular px-3 py-1.5 text-right text-muted">{p.pid}</td>
                  <td className={cn("tabular px-3 py-1.5 text-right", LEVEL_TEXT[usageLevel(p.cpuPercent)])}>
                    {f.percent(p.cpuPercent, 1)}
                  </td>
                  <td className="tabular px-3 py-1.5 text-right text-text">{f.bytes(p.memoryBytes)}</td>
                  <td className="px-3 py-1.5 text-right">
                    {p.protected ? (
                      <Tooltip
                        content={td(
                          `processes.protectedReason.${p.protectionReason ?? ""}`,
                          t("topProcesses.protected"),
                        )}
                      >
                        <span className="inline-flex h-7 items-center gap-1 px-2 text-xs text-muted">
                          <ShieldCheck className="size-4" aria-hidden />
                          {t("topProcesses.protected")}
                        </span>
                      </Tooltip>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setTarget(p)}
                        loading={store.killing.includes(p.pid)}
                        aria-label={`${t("processes.kill")} ${p.name} (${p.pid})`}
                      >
                        {t("processes.kill")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={target !== null}
        tone="danger"
        title={t("processes.confirmTitle", { name: target ? stripExe(target.name) : "" })}
        description={t("processes.confirmBody", { pid: target?.pid ?? 0 })}
        confirmLabel={t("processes.kill")}
        confirmLoading={killing}
        locked={killing}
        onConfirm={() => void confirmKill()}
        onClose={() => !killing && setTarget(null)}
        cancelLabel={t("actions.cancel")}
      />
    </div>
  );
}
