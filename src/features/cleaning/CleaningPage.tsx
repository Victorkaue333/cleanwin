import {
  AlertTriangle,
  Brush,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Lock,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useErrorMessage } from "@/hooks/useErrorMessage";
import { useFormat, useT, useTDynamic } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import * as ipc from "@/services/ipc";
import { cleanableSelection, selectedTotals, useCleaningStore } from "@/stores/cleaningStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";
import type { CleanCategoryInfo } from "@/types/ipc";

export function CleaningPage() {
  const t = useT();
  const f = useFormat();
  const describe = useErrorMessage();
  const store = useCleaningStore();
  const defaults = useSettingsStore((s) => s.settings.cleaning.defaultCategories);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    void store.loadCategories(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = store.phase === "scanning" || store.phase === "cleaning";
  const totals = selectedTotals(store.selected, store.scanResults);
  const cleanable = cleanableSelection(store.selected, store.scanResults);
  const canClean = store.phase === "scanned" && cleanable.length > 0;

  async function runScan() {
    if (store.selected.length === 0) {
      toast.warning(t("cleaning.selectOne"));
      return;
    }
    const summary = await store.scan();
    if (summary) {
      if (summary.cancelled) toast.info(t("cleaning.scanCancelled"));
      else if (summary.totalFiles === 0) toast.info(t("cleaning.noResults"));
      else toast.success(t("cleaning.scanDone", { duration: f.duration(summary.durationMs) }));
    } else if (useCleaningStore.getState().error) {
      const { title, detail } = describe(useCleaningStore.getState().error);
      toast.danger(title, detail);
    }
  }

  async function runClean() {
    setConfirm(false);
    const summary = await store.clean();
    if (summary) {
      if (summary.cancelled) toast.warning(t("cleaning.cancelled"));
      else toast.success(t("cleaning.done"), `${t("cleaning.freed")}: ${f.bytes(summary.freedBytes)}`);
    } else if (useCleaningStore.getState().error) {
      const { title, detail } = describe(useCleaningStore.getState().error);
      toast.danger(title, detail);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3">
      <SectionTitle
        title={t("cleaning.title")}
        subtitle={t("cleaning.subtitle")}
        aside={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={store.selectAll} disabled={busy}>
              {t("cleaning.selectAll")}
            </Button>
            <Button size="sm" variant="ghost" onClick={store.clearSelection} disabled={busy}>
              {t("cleaning.clearAll")}
            </Button>
          </div>
        }
      />

      {store.error && store.phase === "error" && (
        <ErrorState
          title={describe(store.error).title}
          details={store.error.message}
          detailsLabel={t("errors.details")}
          retryLabel={t("actions.retry")}
          onRetry={() => store.reset()}
        />
      )}

      <div className="flex flex-col gap-2">
        {!store.categoriesLoaded &&
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-card" />)}
        {store.categories.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </div>

      {/* Sticky action bar */}
      <Card className="sticky bottom-0 flex flex-wrap items-center gap-3 bg-surface/95 backdrop-blur">
        <div className="min-w-0 flex-1 text-sm">
          {store.phase === "scanned" && store.scanSummary && (
            <span className="text-muted">
              {t("cleaning.totalFound")}:{" "}
              <strong className="tabular text-text">{f.bytes(store.scanSummary.totalBytes)}</strong>{" "}
              · {t("cleaning.files", { count: f.integer(store.scanSummary.totalFiles) })}
              {totals.categories > 0 && (
                <>
                  {" "}
                  · {t("cleaning.selected")}:{" "}
                  <strong className="tabular text-primary">{f.bytes(totals.bytes)}</strong>
                </>
              )}
            </span>
          )}
          {store.phase === "done" && store.cleanSummary && (
            <span className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              {t("cleaning.freed")}:{" "}
              <strong className="tabular">{f.bytes(store.cleanSummary.freedBytes)}</strong>
              {store.cleanSummary.lockedFiles > 0 && (
                <span className="text-muted">
                  · {t("cleaning.locked")}: {f.integer(store.cleanSummary.lockedFiles)}
                </span>
              )}
            </span>
          )}
          {store.phase === "idle" && (
            <span className="text-muted">{t("cleaning.scanFirst")}</span>
          )}
          {busy && (
            <span className="text-muted">
              {store.phase === "scanning" ? t("cleaning.scanning") : t("cleaning.cleaning")}
            </span>
          )}
        </div>
        {busy ? (
          <Button variant="outline" onClick={() => void store.cancel()} loading={store.cancelling}>
            {store.cancelling ? t("cleaning.cancelling") : t("cleaning.cancel")}
          </Button>
        ) : (
          <>
            <Button
              variant={store.phase === "scanned" || store.phase === "done" ? "secondary" : "primary"}
              onClick={() => void runScan()}
              disabled={store.selected.length === 0}
              icon={<Sparkles className="size-4" aria-hidden />}
            >
              {store.phase === "idle" ? t("cleaning.scan") : t("cleaning.rescan")}
            </Button>
            {store.phase === "scanned" && (
              <Button
                variant="primary"
                onClick={() => setConfirm(true)}
                disabled={!canClean}
                icon={<Brush className="size-4" aria-hidden />}
              >
                {t("cleaning.clean")}
              </Button>
            )}
          </>
        )}
      </Card>

      <Dialog
        open={confirm}
        tone="danger"
        size="md"
        title={t("cleaning.confirmTitle", { files: f.integer(totals.files) })}
        description={t("cleaning.confirmBody", {
          size: f.bytes(totals.bytes),
          categories: totals.categories,
        })}
        confirmLabel={t("cleaning.confirmButton", { size: f.bytes(totals.bytes) })}
        onConfirm={() => void runClean()}
        onClose={() => setConfirm(false)}
        cancelLabel={t("actions.cancel")}
      >
        <ul className="flex flex-col gap-1 text-sm">
          {cleanable.map((id) => {
            const r = store.scanResults[id];
            return (
              <li key={id} className="flex justify-between gap-2">
                <span className="truncate text-text">
                  <CategoryName id={id} />
                </span>
                <span className="tabular shrink-0 text-muted">
                  {r ? `${f.integer(r.fileCount)} · ${f.bytes(r.totalBytes)}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </div>
  );
}

function CategoryName({ id }: { id: string }) {
  const td = useTDynamic();
  return <>{td(`cleaning.cat.${id}.name`, id)}</>;
}

function CategoryRow({ category }: { category: CleanCategoryInfo }) {
  const t = useT();
  const td = useTDynamic();
  const f = useFormat();
  const store = useCleaningStore();
  const selected = store.selected.includes(category.id);
  const scan = store.scanProgress[category.id];
  const result = store.scanResults[category.id];
  const cleanP = store.cleanProgress[category.id];
  const cleanR = store.cleanResults[category.id];
  const expanded = store.expanded === category.id;
  const busy = store.phase === "scanning" || store.phase === "cleaning";
  const disabled = !category.available || busy;
  const name = td(`cleaning.cat.${category.id}.name`, category.id);
  const description = td(`cleaning.cat.${category.id}.description`, "");

  const scanning = store.phase === "scanning" && scan && !scan.finished;
  const cleaning = store.phase === "cleaning" && cleanP && !cleanP.finished;
  const cleanPercent =
    cleanP && cleanP.fileCount > 0 ? Math.min(100, (cleanP.processed / cleanP.fileCount) * 100) : null;

  return (
    <Card
      padding="none"
      className={cn("overflow-hidden", selected && category.available && "border-primary/40")}
    >
      <div className="flex items-start gap-3 p-3">
        <Checkbox
          checked={selected && category.available}
          disabled={disabled}
          onChange={() => store.toggle(category.id)}
          label={name}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text">{name}</span>
            {!category.available && <Badge>{t("cleaning.unavailable")}</Badge>}
            {category.requiresAdmin && (
              <Tooltip content={t("cleaning.requiresAdmin")}>
                <Badge tone="warning">
                  <ShieldAlert className="size-3" aria-hidden /> admin
                </Badge>
              </Tooltip>
            )}
            {category.closesAppsHint && (
              <Tooltip content={t("cleaning.closesApps")}>
                <Badge>
                  <Lock className="size-3" aria-hidden /> {t("cleaning.closesApps").split(" ")[0]}
                </Badge>
              </Tooltip>
            )}
            {result?.partial && (
              <Tooltip content={t("cleaning.accessDenied", { count: result.accessDeniedCount })}>
                <Badge tone="warning">
                  <AlertTriangle className="size-3" aria-hidden /> {t("cleaning.partial")}
                </Badge>
              </Tooltip>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">{description}</p>

          {(scanning || (scan && store.phase === "scanning")) && (
            <div className="mt-2 flex items-center gap-3 text-xs text-muted">
              <ProgressBar percent={scan?.finished ? 100 : null} label={name} size="sm" level="accent" className="max-w-[12rem]" />
              <span className="tabular">
                {t("cleaning.files", { count: f.integer(scan?.fileCount ?? 0) })} ·{" "}
                {f.bytes(scan?.totalBytes ?? 0)}
              </span>
            </div>
          )}

          {(cleaning || cleanP) && store.phase !== "scanned" && (
            <div className="mt-2 flex items-center gap-3 text-xs text-muted">
              <ProgressBar
                percent={cleanP?.finished ? 100 : cleanPercent}
                label={name}
                size="sm"
                level="accent"
                className="max-w-[12rem]"
              />
              <span className="tabular">
                {t("cleaning.progress", {
                  processed: f.integer(cleanP?.processed ?? 0),
                  total: f.integer(cleanP?.fileCount ?? 0),
                })}{" "}
                · {f.bytes(cleanP?.freedBytes ?? 0)}
              </span>
            </div>
          )}

          {cleanR && (store.phase === "done" || store.phase === "error") && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge tone="success">
                <CheckCircle2 className="size-3" aria-hidden />
                {t("cleaning.deleted")}: {f.integer(cleanR.deletedFiles)} · {f.bytes(cleanR.freedBytes)}
              </Badge>
              {cleanR.lockedFiles > 0 && (
                <Badge tone="warning">
                  <Lock className="size-3" aria-hidden /> {t("cleaning.locked")}: {f.integer(cleanR.lockedFiles)}
                </Badge>
              )}
              {cleanR.failedFiles > 0 && (
                <Badge tone="danger">
                  <XCircle className="size-3" aria-hidden /> {t("cleaning.failed")}: {f.integer(cleanR.failedFiles)}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {result ? (
            <>
              <span className="tabular text-sm font-semibold text-text">
                {result.fileCount === 0 ? t("cleaning.nothingFound") : f.bytes(result.totalBytes)}
              </span>
              {result.fileCount > 0 && (
                <span className="tabular text-xs text-muted">
                  {t("cleaning.files", { count: f.integer(result.fileCount) })}
                </span>
              )}
            </>
          ) : scan && store.phase === "scanning" ? (
            <Skeleton className="h-4 w-16" />
          ) : null}
          {category.available && (
            <button
              type="button"
              onClick={() => store.setExpanded(expanded ? null : category.id)}
              aria-expanded={expanded}
              className="mt-1 inline-flex items-center gap-1 rounded-md text-xs text-muted hover:text-text"
            >
              {expanded ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
              {result && result.fileCount > 0 ? t("cleaning.preview") : t("cleaning.paths")}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-bg/40 px-3 py-2.5 text-xs">
          <p className="mb-1.5 font-medium text-muted">{t("cleaning.paths")}</p>
          <ul className="flex flex-col gap-1">
            {(result?.roots ?? category.roots).map((root) => (
              <li key={root} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void ipc.revealPath(root).catch(() => undefined)}
                  className="inline-flex items-center gap-1 rounded-md text-muted hover:text-text"
                  aria-label={`${t("actions.openFolder")}: ${root}`}
                >
                  <FolderOpen className="size-3.5" aria-hidden />
                </button>
                <span className="truncate font-mono text-[11px] text-text/80" title={root}>
                  {root}
                </span>
              </li>
            ))}
          </ul>
          {result && result.skippedRecentCount > 0 && (
            <p className="mt-2 text-muted">
              {t("cleaning.skippedRecent", {
                count: f.integer(result.skippedRecentCount),
                size: f.bytes(result.skippedRecentBytes),
              })}
            </p>
          )}
          {result && result.largest.length > 0 && (
            <>
              <p className="mt-3 mb-1.5 font-medium text-muted">
                {t("cleaning.previewHint", { count: result.largest.length })}
              </p>
              <ul className="max-h-48 overflow-auto rounded-lg border border-border">
                {result.largest.map((file) => (
                  <li key={file.path} className="flex items-center gap-3 border-b border-border px-2 py-1 last:border-b-0">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text/80" title={file.path}>
                      {f.shortenPath(file.path, 70)}
                    </span>
                    <span className="tabular shrink-0 text-muted">{f.date(file.modifiedMs)}</span>
                    <span className="tabular w-16 shrink-0 text-right text-text">{f.bytes(file.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {cleanR && cleanR.errors.length > 0 && (
            <>
              <p className="mt-3 mb-1 font-medium text-danger">{t("cleaning.errors")}</p>
              <ul className="max-h-32 overflow-auto">
                {cleanR.errors.map((e) => (
                  <li key={e.path} className="truncate font-mono text-[11px] text-muted" title={`${e.path}: ${e.reason}`}>
                    {f.shortenPath(e.path, 60)} — {e.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result && result.fileCount === 0 && (
            <EmptyState title={t("cleaning.nothingFound")} className="mt-2 py-4" />
          )}
        </div>
      )}
    </Card>
  );
}
