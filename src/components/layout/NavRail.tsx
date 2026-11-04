import {
  Activity,
  Brush,
  Home,
  Info,
  ListTree,
  Maximize2,
  Minimize2,
  Settings,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { Tooltip } from "@/components/ui/Tooltip";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import { useUiStore, type PageId } from "@/stores/uiStore";
import type { ViewMode } from "@/types/ipc";

const ITEMS: { id: PageId; icon: LucideIcon; key: `nav.${PageId}` }[] = [
  { id: "dashboard", icon: Home, key: "nav.dashboard" },
  { id: "cleaning", icon: Brush, key: "nav.cleaning" },
  { id: "monitoring", icon: Activity, key: "nav.monitoring" },
  { id: "processes", icon: ListTree, key: "nav.processes" },
  { id: "utilities", icon: Wrench, key: "nav.utilities" },
  { id: "settings", icon: Settings, key: "nav.settings" },
  { id: "about", icon: Info, key: "nav.about" },
];

export function NavRail({
  mode,
  onToggleMode,
}: {
  mode: ViewMode;
  onToggleMode: (next: ViewMode) => void;
}) {
  const t = useT();
  const page = useUiStore((s) => s.page);
  const setPage = useUiStore((s) => s.setPage);
  const compact = mode === "compact";

  return (
    <nav
      aria-label="Navegação"
      className={cn(
        "flex shrink-0 flex-col items-stretch border-r border-border bg-bg",
        compact ? "w-16 px-2.5 py-2" : "w-52 px-3 py-3",
      )}
    >
      <div className={cn("mb-3 flex items-center", compact ? "justify-center" : "px-2")}>
        <BrandLogo variant="symbol" height={compact ? 30 : 28} />
        {!compact && (
          <span className="ml-2 text-sm font-bold tracking-tight text-text">
            Clean<span className="text-primary">Win</span>
          </span>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-1.5">
        {ITEMS.map(({ id, icon: Icon, key }) => {
          const active = page === id;
          const label = t(key);
          const button = (
            <button
              type="button"
              onClick={() => setPage(id)}
              aria-current={active ? "page" : undefined}
              aria-label={compact ? label : undefined}
              className={cn(
                "flex w-full items-center rounded-xl border transition-colors",
                compact ? "h-11 justify-center" : "h-10 gap-3 px-3",
                active
                  ? "border-primary/60 bg-primary-soft text-primary shadow-[inset_0_0_0_1px_var(--color-primary-soft)]"
                  : "border-transparent text-muted hover:bg-surface-hover hover:text-text",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {!compact && <span className="text-sm font-medium">{label}</span>}
            </button>
          );
          return (
            <li key={id}>
              {compact ? (
                <Tooltip content={label} side="bottom" className="w-full">
                  {button}
                </Tooltip>
              ) : (
                button
              )}
            </li>
          );
        })}
      </ul>

      <div className={cn("mt-2", compact ? "flex justify-center" : "")}>
        <Tooltip content={compact ? t("nav.expand") : t("nav.collapse")} className="w-full">
          <button
            type="button"
            onClick={() => onToggleMode(compact ? "full" : "compact")}
            aria-label={compact ? t("nav.expand") : t("nav.collapse")}
            className={cn(
              "flex w-full items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-text",
              compact ? "h-10 justify-center" : "h-9 gap-3 px-3",
            )}
          >
            {compact ? (
              <Maximize2 className="size-[18px]" aria-hidden />
            ) : (
              <>
                <Minimize2 className="size-[18px]" aria-hidden />
                <span className="text-xs font-medium">{t("app.openCompact")}</span>
              </>
            )}
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}
