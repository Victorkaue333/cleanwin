import { create } from "zustand";

import { pushHistory } from "@/lib/history";
import type { StaticSystemInfo, SystemSnapshot } from "@/types/ipc";

export const HISTORY_SIZE = 60;

export type MetricsStatus = "loading" | "ready" | "error";

export interface MetricsHistory {
  cpu: number[];
  memory: number[];
  download: number[];
  upload: number[];
  gpu: number[];
}

const EMPTY_HISTORY: MetricsHistory = { cpu: [], memory: [], download: [], upload: [], gpu: [] };

interface MetricsState {
  status: MetricsStatus;
  snapshot: SystemSnapshot | null;
  info: StaticSystemInfo | null;
  history: MetricsHistory;
  error: string | null;
  lastUpdateMs: number;
  applySnapshot: (snapshot: SystemSnapshot) => void;
  setInfo: (info: StaticSystemInfo | null) => void;
  setError: (message: string) => void;
  reset: () => void;
}

/** Pure reducer so the history logic is testable without the store. */
export function appendSnapshot(history: MetricsHistory, snapshot: SystemSnapshot): MetricsHistory {
  return {
    cpu: pushHistory(history.cpu, snapshot.cpu.usagePercent, HISTORY_SIZE),
    memory: pushHistory(history.memory, snapshot.memory.usagePercent, HISTORY_SIZE),
    download: pushHistory(history.download, snapshot.network.downloadBps, HISTORY_SIZE),
    upload: pushHistory(history.upload, snapshot.network.uploadBps, HISTORY_SIZE),
    gpu: pushHistory(history.gpu, snapshot.gpu?.usagePercent ?? 0, HISTORY_SIZE),
  };
}

export const useMetricsStore = create<MetricsState>((set) => ({
  status: "loading",
  snapshot: null,
  info: null,
  history: EMPTY_HISTORY,
  error: null,
  lastUpdateMs: 0,

  applySnapshot(snapshot) {
    set((state) => ({
      status: "ready",
      error: null,
      snapshot,
      history: appendSnapshot(state.history, snapshot),
      lastUpdateMs: Date.now(),
    }));
  },

  setInfo(info) {
    set({ info });
  },

  setError(message) {
    set((state) => ({ status: state.snapshot ? state.status : "error", error: message }));
  },

  reset() {
    set({ status: "loading", snapshot: null, history: EMPTY_HISTORY, error: null });
  },
}));
