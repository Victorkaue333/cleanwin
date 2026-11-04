import { useState } from "react";

import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { useErrorMessage } from "@/hooks/useErrorMessage";
import { useT } from "@/hooks/useT";
import { TRAY_RETRY_ATTEMPTS, TRAY_RETRY_DELAY_MS } from "@/lib/onboarding";
import * as ipc from "@/services/ipc";
import { useSettingsStore } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Pin the tray icon, retrying while Explorer has not registered it yet. */
async function pinTrayIcon(): Promise<boolean> {
  for (let attempt = 1; attempt <= TRAY_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await ipc.setTrayIconPromoted(true);
    } catch (error) {
      const notFound = (error as { code?: string }).code === "not_found";
      if (!notFound || attempt === TRAY_RETRY_ATTEMPTS) throw error;
      await sleep(TRAY_RETRY_DELAY_MS);
    }
  }
  return false;
}

/** First-run dialog. Rendered by `App` only when `shouldShowOnboarding(...)` holds. */
export function OnboardingDialog() {
  const t = useT();
  const describe = useErrorMessage();
  const update = useSettingsStore((s) => s.update);
  const [tray, setTray] = useState(true);
  const [autostart, setAutostart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);

  async function finish(apply: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (apply && tray) {
        try {
          const pinned = await pinTrayIcon();
          // The backend persisted `trayIconPromoted`; mirror it so the next full-object save keeps it.
          useSettingsStore.setState((s) => ({
            settings: { ...s.settings, trayIconPromoted: pinned },
          }));
        } catch (error) {
          if ((error as { code?: string }).code === "not_found") {
            toast.warning(t("onboarding.trayLater"), t("onboarding.trayLaterDesc"));
          } else {
            const { title, detail } = describe(error);
            toast.danger(title, detail);
          }
        }
      }
      await update(
        apply && autostart
          ? { launchAtStartup: true, startMinimized: true, onboardingShown: true }
          : { onboardingShown: true },
      );
    } catch (error) {
      const { detail } = describe(error);
      toast.danger(t("onboarding.saveFailed"), detail);
    } finally {
      setBusy(false);
      setClosed(true);
    }
  }

  return (
    <Dialog
      open={!closed}
      title={t("onboarding.title")}
      description={t("onboarding.description")}
      onClose={() => void finish(false)}
      cancelLabel={t("onboarding.skip")}
      confirmLabel={t("onboarding.apply")}
      onConfirm={() => void finish(true)}
      confirmLoading={busy}
      locked={busy}
    >
      <ul className="flex flex-col gap-3 text-sm text-text">
        <li className="flex items-center gap-3">
          <Checkbox
            id="onboarding-tray"
            checked={tray}
            onChange={(e) => setTray(e.target.checked)}
            disabled={busy}
          />
          <label htmlFor="onboarding-tray" className="cursor-pointer">
            {t("onboarding.trayIcon")}
          </label>
        </li>
        <li className="flex items-center gap-3">
          <Checkbox
            id="onboarding-autostart"
            checked={autostart}
            onChange={(e) => setAutostart(e.target.checked)}
            disabled={busy}
          />
          <label htmlFor="onboarding-autostart" className="cursor-pointer">
            {t("onboarding.autostart")}
          </label>
        </li>
      </ul>
    </Dialog>
  );
}
