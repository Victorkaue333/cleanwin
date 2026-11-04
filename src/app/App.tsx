import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { OnboardingDialog } from "@/components/shared/OnboardingDialog";
import { Toaster } from "@/components/ui/Toaster";
import { CleaningPage } from "@/features/cleaning/CleaningPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { MonitoringPage } from "@/features/monitoring/MonitoringPage";
import { ProcessesPage } from "@/features/processes/ProcessesPage";
import { AboutPage } from "@/features/settings/AboutPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { UtilitiesPage } from "@/features/utilities/UtilitiesPage";
import { useMetricsEvents } from "@/hooks/useMetricsEvents";
import { shouldShowOnboarding } from "@/lib/onboarding";
import * as ipc from "@/services/ipc";
import { useSettingsStore } from "@/stores/settingsStore";
import { isPageId, useUiStore } from "@/stores/uiStore";
import type { ViewMode } from "@/types/ipc";

export default function App() {
  const settings = useSettingsStore((s) => s.settings);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const loadSettings = useSettingsStore((s) => s.load);
  const page = useUiStore((s) => s.page);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const setPage = useUiStore((s) => s.setPage);
  const setAppInfo = useUiStore((s) => s.setAppInfo);
  const readySent = useRef(false);
  const [windowVisible, setWindowVisible] = useState(false);

  useMetricsEvents();

  // Bootstrap: settings → app info → reveal window (once). Tray "navigate" events.
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      await loadSettings();
      ipc
        .getAppInfo()
        .then((info) => {
          if (!disposed) setAppInfo(info);
        })
        .catch(() => undefined);
      if (!readySent.current) {
        readySent.current = true;
        ipc
          .frontendReady()
          .then((visible) => {
            if (!disposed) setWindowVisible(visible);
          })
          .catch(() => undefined);
      }
    })();
    ipc
      .onNavigate((target) => {
        if (!disposed && isPageId(target)) setPage(target);
      })
      .then((fn) => (disposed ? fn() : (unlisten = fn)))
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [loadSettings, setAppInfo, setPage]);

  // Mirror persisted view mode into UI state once settings arrive.
  useEffect(() => {
    if (settingsLoaded) setViewMode(settings.viewMode);
  }, [settingsLoaded, settings.viewMode, setViewMode]);

  // Language + reduced motion on the document.
  useEffect(() => {
    document.documentElement.lang = settings.language;
    document.documentElement.dataset.reduceMotion = settings.reduceMotion ? "true" : "false";
  }, [settings.language, settings.reduceMotion]);

  const toggleMode = useCallback(
    (next: ViewMode) => {
      setViewMode(next);
      // Rust resizes the window and persists the preference; mirror the saved
      // settings so the Settings page shows the real view mode.
      ipc
        .setViewMode(next)
        .then((saved) => useSettingsStore.setState({ settings: saved }))
        .catch(() => undefined);
    },
    [setViewMode],
  );

  return (
    <>
      <AppShell mode={viewMode} onToggleMode={toggleMode}>
        <div key={page} className="animate-[cw-fade-in_160ms_ease-out] pt-1">
          {page === "dashboard" && <DashboardPage mode={viewMode} onToggleMode={toggleMode} />}
          {page === "monitoring" && <MonitoringPage />}
          {page === "cleaning" && <CleaningPage />}
          {page === "processes" && <ProcessesPage />}
          {page === "utilities" && <UtilitiesPage />}
          {page === "settings" && <SettingsPage />}
          {page === "about" && <AboutPage />}
        </div>
      </AppShell>
      {shouldShowOnboarding({
        settingsLoaded,
        onboardingShown: settings.onboardingShown,
        windowVisible,
      }) && <OnboardingDialog />}
      <Toaster />
    </>
  );
}
