import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useCallback, useEffect } from "react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/uiStore";

/** Custom title bar (window has `decorations: false`). */
export function TitleBar({ className }: { className?: string }) {
  const t = useT();
  const maximized = useUiStore((s) => s.maximized);
  const setMaximized = useUiStore((s) => s.setMaximized);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    const win = getCurrentWindow();
    win
      .isMaximized()
      .then((v) => {
        if (!cancelled) setMaximized(v);
      })
      .catch(() => undefined);
    win
      .onResized(() => {
        win
          .isMaximized()
          .then((v) => setMaximized(v))
          .catch(() => undefined);
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [setMaximized]);

  const minimize = useCallback(() => void getCurrentWindow().minimize(), []);
  const toggleMaximize = useCallback(() => void getCurrentWindow().toggleMaximize(), []);
  // `close()` raises CloseRequested so Rust applies the configured close behaviour.
  const close = useCallback(() => void getCurrentWindow().close(), []);

  return (
    <header
      data-tauri-drag-region
      className={cn("flex h-11 shrink-0 items-center justify-between pl-3 pr-1 select-none", className)}
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <BrandLogo variant="horizontal" height={26} />
      </div>
      <div className="no-drag flex items-center">
        <WindowButton label={t("titlebar.minimize")} onClick={minimize}>
          <Minus className="size-4" />
        </WindowButton>
        <WindowButton
          label={maximized ? t("titlebar.restore") : t("titlebar.maximize")}
          onClick={toggleMaximize}
        >
          {maximized ? <Copy className="size-3.5" /> : <Square className="size-3.5" />}
        </WindowButton>
        <WindowButton label={t("titlebar.close")} onClick={close} danger>
          <X className="size-4" />
        </WindowButton>
      </div>
    </header>
  );
}

function WindowButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-11 items-center justify-center rounded-md text-muted transition-colors",
        danger ? "hover:bg-danger hover:text-text" : "hover:bg-surface-hover hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
