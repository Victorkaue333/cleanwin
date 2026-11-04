import { create } from "zustand";

import { toAppError, type AppError } from "@/lib/errors";
import * as ipc from "@/services/ipc";
import type { RecycleBinInfo, RecycleBinResult, UtilitiesState } from "@/types/ipc";

interface UtilitiesStoreState {
  state: UtilitiesState | null;
  recycleBin: RecycleBinInfo | null;
  recycleBinError: AppError | null;
  busy: "keepAwake" | "desktop" | "recycleBin" | null;
  error: AppError | null;
  load: () => Promise<void>;
  loadRecycleBin: () => Promise<void>;
  setKeepAwake: (enabled: boolean) => Promise<void>;
  setDesktopIcons: (visible: boolean) => Promise<void>;
  emptyRecycleBin: () => Promise<RecycleBinResult>;
}

export const useUtilitiesStore = create<UtilitiesStoreState>((set, get) => ({
  state: null,
  recycleBin: null,
  recycleBinError: null,
  busy: null,
  error: null,

  async load() {
    try {
      const state = await ipc.getUtilitiesState();
      set({ state, error: null });
    } catch (error) {
      set({ error: toAppError(error) });
    }
  },

  async loadRecycleBin() {
    try {
      const recycleBin = await ipc.getRecycleBinInfo();
      set({ recycleBin, recycleBinError: null });
    } catch (error) {
      set({ recycleBinError: toAppError(error) });
    }
  },

  async setKeepAwake(enabled) {
    if (get().busy) return;
    set({ busy: "keepAwake", error: null });
    try {
      const state = await ipc.setKeepAwake(enabled);
      set({ state, busy: null });
    } catch (error) {
      set({ busy: null, error: toAppError(error) });
      throw toAppError(error);
    }
  },

  async setDesktopIcons(visible) {
    if (get().busy) return;
    set({ busy: "desktop", error: null });
    try {
      const state = await ipc.setDesktopIconsVisible(visible);
      set({ state, busy: null });
    } catch (error) {
      set({ busy: null, error: toAppError(error) });
      throw toAppError(error);
    }
  },

  async emptyRecycleBin() {
    set({ busy: "recycleBin", error: null });
    try {
      const result = await ipc.emptyRecycleBin();
      const recycleBin = await ipc.getRecycleBinInfo().catch(() => null);
      set({ busy: null, recycleBin });
      return result;
    } catch (error) {
      set({ busy: null, error: toAppError(error) });
      throw toAppError(error);
    }
  },
}));
