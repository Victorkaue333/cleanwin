import { create } from "zustand";

import type { AppInfo, ViewMode } from "@/types/ipc";

export const PAGES = [
  "dashboard",
  "monitoring",
  "cleaning",
  "processes",
  "utilities",
  "settings",
  "about",
] as const;

export type PageId = (typeof PAGES)[number];

export function isPageId(value: string): value is PageId {
  return (PAGES as readonly string[]).includes(value);
}

interface UiState {
  page: PageId;
  viewMode: ViewMode;
  appInfo: AppInfo | null;
  maximized: boolean;
  setPage: (page: PageId) => void;
  setViewMode: (mode: ViewMode) => void;
  setAppInfo: (info: AppInfo) => void;
  setMaximized: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  page: "dashboard",
  viewMode: "compact",
  appInfo: null,
  maximized: false,
  setPage: (page) => set({ page }),
  setViewMode: (viewMode) => set({ viewMode }),
  setAppInfo: (appInfo) => set({ appInfo }),
  setMaximized: (maximized) => set({ maximized }),
}));
