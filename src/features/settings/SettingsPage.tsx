import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, SectionTitle } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorState } from "@/components/ui/ErrorState";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { useErrorMessage } from "@/hooks/useErrorMessage";
import { useT, useTDynamic } from "@/hooks/useT";
import { LANGUAGES } from "@/i18n";
import { TRAY_REQUERY_DELAY_MS, TRAY_REQUERY_MAX, trayToggleState } from "@/lib/onboarding";
import * as ipc from "@/services/ipc";
import { useCleaningStore } from "@/stores/cleaningStore";
import { useSettingsStore, type SettingsPatch } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import type { CloseBehavior, Language, ViewMode } from "@/types/ipc";

const INTERVALS = [500, 1000, 1500, 2000, 3000, 5000, 10000];
const RECENT_HOURS = [1, 6, 12, 24, 48, 72, 168];
const CATEGORY_IDS = [
  "user_temp",
  "windows_temp",
  "browser_cache",
  "crash_reports",
  "shader_cache",
  "thumbnail_cache",
  "inet_cache",
];

export function SettingsPage() {
  const t = useT();
  const td = useTDynamic();
  const describe = useErrorMessage();
  const { settings, update, saving, error } = useSettingsStore();
  const setViewMode = useUiStore((s) => s.setViewMode);
  const knownCategories = useCleaningStore((s) => s.categories);
  const [autostartMismatch, setAutostartMismatch] = useState(false);

  useEffect(() => {
    ipc
      .getAutostartEnabled()
      .then((enabled) => setAutostartMismatch(enabled !== settings.launchAtStartup))
      .catch(() => setAutostartMismatch(false));
  }, [settings.launchAtStartup]);

  // Tray icon pin: `null` = Explorer has not registered the icon yet (re-query a few times).
  const [trayPromoted, setTrayPromoted] = useState<boolean | null>(null);
  const [traySaving, setTraySaving] = useState(false);
  const requeries = useRef(0);

  const queryTray = useCallback(() => {
    ipc
      .getTrayIconPromoted()
      .then(setTrayPromoted)
      .catch(() => setTrayPromoted(null));
  }, []);

  useEffect(() => {
    queryTray();
  }, [queryTray]);

  useEffect(() => {
    if (trayPromoted !== null || requeries.current >= TRAY_REQUERY_MAX) return;
    const timer = setTimeout(() => {
      requeries.current += 1;
      queryTray();
    }, TRAY_REQUERY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [trayPromoted, queryTray]);

  async function changeTray(enabled: boolean) {
    setTraySaving(true);
    try {
      const actual = await ipc.setTrayIconPromoted(enabled);
      setTrayPromoted(actual);
      // The backend persisted the choice; mirror it so full-object saves keep it.
      useSettingsStore.setState((s) => ({ settings: { ...s.settings, trayIconPromoted: enabled } }));
      toast.success(t("settings.saved"));
    } catch (err) {
      const { title, detail } = describe(err);
      toast.danger(title, detail);
      queryTray();
    } finally {
      setTraySaving(false);
    }
  }

  const trayState = trayToggleState(trayPromoted);

  async function save(patch: SettingsPatch) {
    try {
      const saved = await update(patch);
      if (patch.viewMode) setViewMode(saved.viewMode);
      toast.success(t("settings.saved"));
    } catch (err) {
      const { title, detail } = describe(err);
      toast.danger(title, detail);
    }
  }

  const categoryIds = knownCategories.length > 0 ? knownCategories.map((c) => c.id) : CATEGORY_IDS;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <SectionTitle
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        aside={saving && <Badge tone="primary">{t("common.loading")}</Badge>}
      />

      {error && (
        <ErrorState title={describe(error).title} details={error.message} detailsLabel={t("errors.details")} />
      )}

      <Card className="flex flex-col gap-4">
        <CardHeader title={t("settings.startup")} />
        <Toggle
          checked={settings.launchAtStartup}
          onChange={(v) => void save({ launchAtStartup: v })}
          disabled={saving}
          label={t("settings.launchAtStartup")}
          description={
            <>
              {t("settings.launchAtStartupDesc")}
              {autostartMismatch && (
                <span className="mt-1 block text-warning">{t("settings.autostartMismatch")}</span>
              )}
            </>
          }
        />
        <Toggle
          checked={settings.startMinimized}
          onChange={(v) => void save({ startMinimized: v })}
          disabled={saving}
          label={t("settings.startMinimized")}
          description={t("settings.startMinimizedDesc")}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHeader title={t("settings.monitoring")} />
        <Row label={t("settings.refreshInterval")} description={t("settings.refreshIntervalDesc")}>
          <Select<number>
            value={settings.refreshIntervalMs}
            onValueChange={(v) => void save({ refreshIntervalMs: v })}
            disabled={saving}
            aria-label={t("settings.refreshInterval")}
            options={INTERVALS.map((ms) => ({ value: ms, label: t("settings.seconds", { value: ms / 1000 }) }))}
            className="w-32"
          />
        </Row>
        <Toggle
          checked={settings.showTrayMetrics}
          onChange={(v) => void save({ showTrayMetrics: v })}
          disabled={saving}
          label={t("settings.showTrayMetrics")}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHeader title={t("settings.window")} />
        <Row label={t("settings.closeBehavior")}>
          <Select<CloseBehavior>
            value={settings.closeBehavior}
            onValueChange={(v) => void save({ closeBehavior: v })}
            disabled={saving}
            aria-label={t("settings.closeBehavior")}
            options={[
              { value: "minimize_to_tray", label: t("settings.closeMinimize") },
              { value: "exit", label: t("settings.closeExit") },
            ]}
            className="w-52"
          />
        </Row>
        <Toggle
          checked={trayState.checked}
          onChange={(v) => void changeTray(v)}
          disabled={trayState.disabled || traySaving}
          label={t("settings.trayIconPromoted")}
          description={
            <>
              {t("settings.trayIconPromotedDesc")}
              {trayState.pending && (
                <span className="mt-1 block text-warning">{t("settings.trayIconPending")}</span>
              )}
            </>
          }
        />
        <Row label={t("settings.viewMode")}>
          <Select<ViewMode>
            value={settings.viewMode}
            onValueChange={(v) => void save({ viewMode: v })}
            disabled={saving}
            aria-label={t("settings.viewMode")}
            options={[
              { value: "compact", label: t("settings.viewCompact") },
              { value: "full", label: t("settings.viewFull") },
            ]}
            className="w-52"
          />
        </Row>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHeader title={t("settings.interface")} />
        <Row label={t("settings.language")}>
          <Select<Language>
            value={settings.language}
            onValueChange={(v) => void save({ language: v })}
            disabled={saving}
            aria-label={t("settings.language")}
            options={LANGUAGES}
            className="w-52"
          />
        </Row>
        <Toggle
          checked={settings.reduceMotion}
          onChange={(v) => void save({ reduceMotion: v })}
          disabled={saving}
          label={t("settings.reduceMotion")}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHeader title={t("settings.cleaningSection")} />
        <Toggle
          checked={settings.cleaning.skipRecentFiles}
          onChange={(v) => void save({ cleaning: { skipRecentFiles: v } })}
          disabled={saving}
          label={t("settings.skipRecent")}
          description={t("settings.skipRecentDesc")}
        />
        <Row label={t("settings.recentHours")}>
          <Select<number>
            value={settings.cleaning.recentHours}
            onValueChange={(v) => void save({ cleaning: { recentHours: v } })}
            disabled={saving || !settings.cleaning.skipRecentFiles}
            aria-label={t("settings.recentHours")}
            options={RECENT_HOURS.map((h) => ({ value: h, label: t("settings.hours", { count: h }) }))}
            className="w-32"
          />
        </Row>
        <div>
          <p className="mb-2 text-sm font-medium text-text">{t("settings.defaultCategories")}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {categoryIds.map((id) => {
              const checked = settings.cleaning.defaultCategories.includes(id);
              return (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={saving}
                    label={td(`cleaning.cat.${id}.name`, id)}
                    onChange={() =>
                      void save({
                        cleaning: {
                          defaultCategories: checked
                            ? settings.cleaning.defaultCategories.filter((c) => c !== id)
                            : [...settings.cleaning.defaultCategories, id],
                        },
                      })
                    }
                  />
                  <span className="text-text">{td(`cleaning.cat.${id}.name`, id)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
