import { create } from "zustand";

import { toAppError, type AppError } from "@/lib/errors";
import * as ipc from "@/services/ipc";
import type { Language, Settings } from "@/types/ipc";

export const DEFAULT_SETTINGS: Settings = {
  launchAtStartup: false,
  startMinimized: false,
  refreshIntervalMs: 1500,
  closeBehavior: "minimize_to_tray",
  viewMode: "compact",
  language: "pt-BR",
  showTrayMetrics: true,
  reduceMotion: false,
  cleaning: {
    skipRecentFiles: true,
    recentHours: 24,
    defaultCategories: ["user_temp", "windows_temp", "crash_reports", "shader_cache"],
  },
};

export type SettingsPatch = Partial<Omit<Settings, "cleaning">> & {
  cleaning?: Partial<Settings["cleaning"]>;
};

/** Pure merge used by the store and by tests. */
export function mergeSettings(current: Settings, patch: SettingsPatch): Settings {
  const { cleaning, ...rest } = patch;
  return {
    ...current,
    ...rest,
    cleaning: { ...current.cleaning, ...(cleaning ?? {}) },
  };
}

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  saving: boolean;
  error: AppError | null;
  load: () => Promise<void>;
  update: (patch: SettingsPatch) => Promise<Settings>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  saving: false,
  error: null,

  async load() {
    try {
      const settings = await ipc.getSettings();
      set({ settings, loaded: true, error: null });
    } catch (error) {
      set({ loaded: true, error: toAppError(error) });
    }
  },

  async update(patch) {
    const previous = get().settings;
    const next = mergeSettings(previous, patch);
    set({ settings: next, saving: true, error: null });
    try {
      const saved = await ipc.updateSettings(next);
      set({ settings: saved, saving: false });
      return saved;
    } catch (error) {
      set({ settings: previous, saving: false, error: toAppError(error) });
      throw toAppError(error);
    }
  },
}));

export const selectLanguage = (s: SettingsState): Language => s.settings.language;
