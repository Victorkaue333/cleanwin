import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { ViewMode } from "@/types/ipc";

import { NavRail } from "./NavRail";
import { TitleBar } from "./TitleBar";

export function AppShell({
  mode,
  onToggleMode,
  children,
}: {
  mode: ViewMode;
  onToggleMode: (next: ViewMode) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-bg text-text">
      <NavRail mode={mode} onToggleMode={onToggleMode} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <main
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
            mode === "compact" ? "px-3 pb-3" : "px-6 pb-6",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
