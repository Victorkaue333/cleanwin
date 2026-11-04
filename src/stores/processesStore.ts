import { create } from "zustand";

import { toAppError, type AppError } from "@/lib/errors";
import {
  DEFAULT_PROCESS_SORT,
  filterProcesses,
  sortProcesses,
  toggleSort,
  type ProcessSort,
  type ProcessSortKey,
} from "@/lib/processes";
import * as ipc from "@/services/ipc";
import type { KillResult, ProcessInfo } from "@/types/ipc";

interface ProcessesState {
  list: ProcessInfo[];
  loaded: boolean;
  loading: boolean;
  error: AppError | null;
  query: string;
  sort: ProcessSort;
  killing: number[];
  refresh: () => Promise<void>;
  setQuery: (query: string) => void;
  sortBy: (key: ProcessSortKey) => void;
  kill: (pid: number) => Promise<KillResult>;
}

export const useProcessesStore = create<ProcessesState>((set, get) => ({
  list: [],
  loaded: false,
  loading: false,
  error: null,
  query: "",
  sort: DEFAULT_PROCESS_SORT,
  killing: [],

  async refresh() {
    if (get().loading) return;
    set({ loading: true });
    try {
      const list = await ipc.listProcesses();
      set({ list, loaded: true, loading: false, error: null });
    } catch (error) {
      set({ loaded: true, loading: false, error: toAppError(error) });
    }
  },

  setQuery(query) {
    set({ query });
  },

  sortBy(key) {
    set((state) => ({ sort: toggleSort(state.sort, key) }));
  },

  async kill(pid) {
    set((state) => ({ killing: [...state.killing, pid] }));
    try {
      const result = await ipc.killProcess(pid);
      set((state) => ({
        list: state.list.filter((p) => p.pid !== pid),
        killing: state.killing.filter((k) => k !== pid),
      }));
      return result;
    } catch (error) {
      set((state) => ({ killing: state.killing.filter((k) => k !== pid) }));
      throw toAppError(error);
    }
  },
}));

/** Pure helper (not a zustand selector: it returns a new array on every call). */
export function visibleProcesses(state: Pick<ProcessesState, "list" | "query" | "sort">): ProcessInfo[] {
  return sortProcesses(filterProcesses(state.list, state.query), state.sort);
}
