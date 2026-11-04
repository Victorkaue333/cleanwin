import { create } from "zustand";

import { toAppError, type AppError } from "@/lib/errors";
import * as ipc from "@/services/ipc";
import type {
  CleanCategoryInfo,
  CleanCategoryResult,
  CleanEvent,
  CleanSummary,
  ScanCategoryResult,
  ScanEvent,
  ScanSummary,
} from "@/types/ipc";

export type CleaningPhase =
  | "idle"
  | "scanning"
  | "scanned"
  | "cleaning"
  | "done"
  | "error";

export interface ScanProgress {
  id: string;
  fileCount: number;
  totalBytes: number;
  finished: boolean;
}

export interface CleanProgress {
  id: string;
  fileCount: number;
  processed: number;
  deletedFiles: number;
  freedBytes: number;
  lockedFiles: number;
  failedFiles: number;
  finished: boolean;
}

export interface CleaningState {
  phase: CleaningPhase;
  categories: CleanCategoryInfo[];
  categoriesLoaded: boolean;
  selected: string[];
  scanProgress: Record<string, ScanProgress>;
  scanResults: Record<string, ScanCategoryResult>;
  scanSummary: ScanSummary | null;
  cleanProgress: Record<string, CleanProgress>;
  cleanResults: Record<string, CleanCategoryResult>;
  cleanSummary: CleanSummary | null;
  cancelling: boolean;
  error: AppError | null;
  expanded: string | null;

  loadCategories: (defaultSelection: string[]) => Promise<void>;
  toggle: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setExpanded: (id: string | null) => void;
  scan: () => Promise<ScanSummary | null>;
  clean: () => Promise<CleanSummary | null>;
  cancel: () => Promise<void>;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Pure reducers (unit-tested)
// ---------------------------------------------------------------------------

export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

export function applyScanEvent(
  progress: Record<string, ScanProgress>,
  results: Record<string, ScanCategoryResult>,
  event: ScanEvent,
): { progress: Record<string, ScanProgress>; results: Record<string, ScanCategoryResult> } {
  switch (event.type) {
    case "categoryStarted":
      return {
        progress: {
          ...progress,
          [event.id]: { id: event.id, fileCount: 0, totalBytes: 0, finished: false },
        },
        results,
      };
    case "progress":
      return {
        progress: {
          ...progress,
          [event.id]: {
            id: event.id,
            fileCount: event.fileCount,
            totalBytes: event.totalBytes,
            finished: false,
          },
        },
        results,
      };
    case "categoryFinished":
      return {
        progress: {
          ...progress,
          [event.result.id]: {
            id: event.result.id,
            fileCount: event.result.fileCount,
            totalBytes: event.result.totalBytes,
            finished: true,
          },
        },
        results: { ...results, [event.result.id]: event.result },
      };
    default:
      return { progress, results };
  }
}

export function applyCleanEvent(
  progress: Record<string, CleanProgress>,
  results: Record<string, CleanCategoryResult>,
  event: CleanEvent,
): { progress: Record<string, CleanProgress>; results: Record<string, CleanCategoryResult> } {
  switch (event.type) {
    case "categoryStarted":
      return {
        progress: {
          ...progress,
          [event.id]: {
            id: event.id,
            fileCount: event.fileCount,
            processed: 0,
            deletedFiles: 0,
            freedBytes: 0,
            lockedFiles: 0,
            failedFiles: 0,
            finished: false,
          },
        },
        results,
      };
    case "progress": {
      const current = progress[event.id];
      return {
        progress: {
          ...progress,
          [event.id]: {
            id: event.id,
            fileCount: current?.fileCount ?? event.processed,
            processed: event.processed,
            deletedFiles: event.deletedFiles,
            freedBytes: event.freedBytes,
            lockedFiles: event.lockedFiles,
            failedFiles: event.failedFiles,
            finished: false,
          },
        },
        results,
      };
    }
    case "categoryFinished": {
      const current = progress[event.result.id];
      return {
        progress: {
          ...progress,
          [event.result.id]: {
            id: event.result.id,
            fileCount: current?.fileCount ?? 0,
            processed: current?.fileCount ?? 0,
            deletedFiles: event.result.deletedFiles,
            freedBytes: event.result.freedBytes,
            lockedFiles: event.result.lockedFiles,
            failedFiles: event.result.failedFiles,
            finished: true,
          },
        },
        results: { ...results, [event.result.id]: event.result },
      };
    }
    default:
      return { progress, results };
  }
}

/** Categories that were scanned, are selected and have at least one file. */
export function cleanableSelection(
  selected: readonly string[],
  results: Record<string, ScanCategoryResult>,
): string[] {
  return selected.filter((id) => (results[id]?.fileCount ?? 0) > 0);
}

export function selectedTotals(
  selected: readonly string[],
  results: Record<string, ScanCategoryResult>,
): { files: number; bytes: number; categories: number } {
  let files = 0;
  let bytes = 0;
  let categories = 0;
  for (const id of selected) {
    const r = results[id];
    if (!r || r.fileCount === 0) continue;
    files += r.fileCount;
    bytes += r.totalBytes;
    categories += 1;
  }
  return { files, bytes, categories };
}

// ---------------------------------------------------------------------------

const initialState = {
  phase: "idle" as CleaningPhase,
  categories: [] as CleanCategoryInfo[],
  categoriesLoaded: false,
  selected: [] as string[],
  scanProgress: {},
  scanResults: {},
  scanSummary: null,
  cleanProgress: {},
  cleanResults: {},
  cleanSummary: null,
  cancelling: false,
  error: null,
  expanded: null,
};

export const useCleaningStore = create<CleaningState>((set, get) => ({
  ...initialState,

  async loadCategories(defaultSelection) {
    try {
      const categories = await ipc.listCleanCategories();
      const available = new Set(categories.filter((c) => c.available).map((c) => c.id));
      const selected = get().categoriesLoaded
        ? get().selected.filter((id) => available.has(id))
        : defaultSelection.filter((id) => available.has(id));
      set({ categories, categoriesLoaded: true, selected, error: null });
    } catch (error) {
      set({ categoriesLoaded: true, error: toAppError(error) });
    }
  },

  toggle(id) {
    if (get().phase === "scanning" || get().phase === "cleaning") return;
    set((state) => ({ selected: toggleSelection(state.selected, id) }));
  },

  selectAll() {
    if (get().phase === "scanning" || get().phase === "cleaning") return;
    set((state) => ({
      selected: state.categories.filter((c) => c.available).map((c) => c.id),
    }));
  },

  clearSelection() {
    if (get().phase === "scanning" || get().phase === "cleaning") return;
    set({ selected: [] });
  },

  setExpanded(id) {
    set({ expanded: id });
  },

  async scan() {
    const { selected, phase } = get();
    if (phase === "scanning" || phase === "cleaning" || selected.length === 0) return null;
    set({
      phase: "scanning",
      scanProgress: {},
      scanResults: {},
      scanSummary: null,
      cleanProgress: {},
      cleanResults: {},
      cleanSummary: null,
      cancelling: false,
      error: null,
    });
    try {
      const summary = await ipc.scanCleanup(selected, (event) => {
        set((state) => {
          const next = applyScanEvent(state.scanProgress, state.scanResults, event);
          return { scanProgress: next.progress, scanResults: next.results };
        });
      });
      const results: Record<string, ScanCategoryResult> = {};
      for (const r of summary.categories) results[r.id] = r;
      set({ phase: "scanned", scanSummary: summary, scanResults: results, cancelling: false });
      return summary;
    } catch (error) {
      set({ phase: "error", error: toAppError(error), cancelling: false });
      return null;
    }
  },

  async clean() {
    const { scanSummary, selected, scanResults, phase } = get();
    if (!scanSummary || phase !== "scanned") return null;
    const categories = cleanableSelection(selected, scanResults);
    if (categories.length === 0) return null;
    set({ phase: "cleaning", cleanProgress: {}, cleanResults: {}, cleanSummary: null, cancelling: false, error: null });
    try {
      const summary = await ipc.cleanFiles(
        { sessionId: scanSummary.sessionId, categories },
        (event) => {
          set((state) => {
            const next = applyCleanEvent(state.cleanProgress, state.cleanResults, event);
            return { cleanProgress: next.progress, cleanResults: next.results };
          });
        },
      );
      set({ phase: "done", cleanSummary: summary, cancelling: false });
      return summary;
    } catch (error) {
      set({ phase: "error", error: toAppError(error), cancelling: false });
      return null;
    }
  },

  async cancel() {
    const { phase } = get();
    if (phase !== "scanning" && phase !== "cleaning") return;
    set({ cancelling: true });
    try {
      await ipc.cancelCleanup();
    } catch (error) {
      set({ error: toAppError(error) });
    }
  },

  reset() {
    set((state) => ({
      ...initialState,
      categories: state.categories,
      categoriesLoaded: state.categoriesLoaded,
      selected: state.selected,
    }));
  },
}));
