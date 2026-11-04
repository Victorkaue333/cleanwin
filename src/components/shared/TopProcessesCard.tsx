import { AppWindow, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useErrorMessage } from "@/hooks/useErrorMessage";
import { useFormat, useT } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import * as ipc from "@/services/ipc";
import { toast } from "@/stores/toastStore";
import type { ProcessGroup } from "@/types/ipc";

/** "Processos que mais usam memória" with a per-row "Finalizar" action. */
export function TopProcessesCard({
  groups,
  limit = 3,
  className,
  scroll = true,
}: {
  groups: ProcessGroup[] | null;
  limit?: number;
  className?: string;
  scroll?: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const describe = useErrorMessage();
  const [target, setTarget] = useState<ProcessGroup | null>(null);
  const [killing, setKilling] = useState(false);

  async function confirmKill() {
    if (!target) return;
    setKilling(true);
    let ok = 0;
    let lastError: unknown = null;
    for (const pid of target.pids) {
      try {
        await ipc.killProcess(pid);
        ok += 1;
      } catch (error) {
        lastError = error;
      }
    }
    setKilling(false);
    setTarget(null);
    if (ok > 0) {
      toast.success(
        ok === 1
          ? t("processes.killed", { name: target.name })
          : t("processes.killedMany", { count: ok }),
      );
    }
    if (lastError) {
      const { title, detail } = describe(lastError);
      toast.danger(title, detail);
    }
  }

  const visible = groups ? groups.slice(0, scroll ? Math.max(limit, 6) : limit) : null;

  return (
    <Card padding="none" className={cn("flex flex-col", className)}>
      <div className="px-3.5 pt-3 pb-1.5 text-sm font-semibold text-text">
        {t("topProcesses.title")}
      </div>
      <ul
        className={cn(
          "flex flex-col px-1.5 pb-1.5",
          scroll && "max-h-[7.25rem] overflow-y-auto",
        )}
      >
        {visible === null &&
          Array.from({ length: limit }, (_, i) => (
            <li key={i} className="flex h-8 items-center gap-3 px-2">
              <Skeleton className="size-5 rounded-md" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="ml-auto h-3.5 w-16" />
              <Skeleton className="h-6 w-16 rounded-lg" />
            </li>
          ))}
        {visible !== null && visible.length === 0 && (
          <li className="px-2 py-3 text-xs text-muted">{t("topProcesses.empty")}</li>
        )}
        {visible?.map((g) => (
          <li key={g.name} className="flex h-8 items-center gap-2.5 rounded-lg px-2 hover:bg-surface-hover">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-track text-muted">
              <AppWindow className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-text" title={g.exe ?? g.name}>
              {stripExe(g.name)}
              {g.pids.length > 1 && (
                <span className="ml-1.5 text-[11px] text-muted">
                  ({t("topProcesses.instances", { count: g.pids.length })})
                </span>
              )}
            </span>
            <span className="tabular shrink-0 text-xs font-medium text-text">
              {f.bytes(g.memoryBytes)}
            </span>
            {g.protected ? (
              <Tooltip content={t("topProcesses.protected")}>
                <span className="inline-flex h-6 w-[4.25rem] items-center justify-center text-muted">
                  <ShieldCheck className="size-4" aria-label={t("topProcesses.protected")} />
                </span>
              </Tooltip>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="w-[4.25rem]"
                onClick={() => setTarget(g)}
                aria-label={`${t("topProcesses.kill")} ${g.name}`}
              >
                {t("topProcesses.kill")}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Dialog
        open={target !== null}
        tone="danger"
        title={t("processes.confirmTitle", { name: target ? stripExe(target.name) : "" })}
        description={
          target && target.pids.length > 1
            ? t("processes.confirmGroupBody", { count: target.pids.length, name: target.name })
            : t("processes.confirmBody", { pid: target?.pids[0] ?? 0 })
        }
        confirmLabel={t("topProcesses.kill")}
        confirmLoading={killing}
        locked={killing}
        onConfirm={() => void confirmKill()}
        onClose={() => !killing && setTarget(null)}
        cancelLabel={t("actions.cancel")}
      />
    </Card>
  );
}

export function stripExe(name: string): string {
  return name.replace(/\.exe$/i, "");
}
