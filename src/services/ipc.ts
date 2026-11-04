/**
 * Typed wrappers around the Tauri commands registered in
 * `src-tauri/src/commands/mod.rs`. Every call normalises errors to `AppError`.
 */
import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { toAppError } from "@/lib/errors";
import type {
  AppInfo,
  CleanCategoryInfo,
  CleanEvent,
  CleanRequest,
  CleanSummary,
  KillResult,
  ProcessInfo,
  RecycleBinInfo,
  RecycleBinResult,
  ScanEvent,
  ScanSummary,
  Settings,
  StaticSystemInfo,
  SystemSnapshot,
  UtilitiesState,
  ViewMode,
} from "@/types/ipc";

export const EVENTS = {
  metricsUpdate: "metrics:update",
  metricsError: "metrics:error",
  navigate: "navigate",
} as const;

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw toAppError(error);
  }
}

// App / window -----------------------------------------------------------------
export const frontendReady = () => call<boolean>("frontend_ready");
export const getAppInfo = () => call<AppInfo>("get_app_info");
export const setViewMode = (mode: ViewMode) => call<Settings>("set_view_mode", { mode });
export const hideToTray = () => call<void>("hide_to_tray");
export const exitApp = () => call<void>("exit_app");
export const openExternal = (url: string) => call<void>("open_external", { url });
export const revealPath = (path: string) => call<void>("reveal_path", { path });

// Metrics ----------------------------------------------------------------------
export const getSystemSnapshot = () => call<SystemSnapshot | null>("get_system_snapshot");
export const getSystemInfo = () => call<StaticSystemInfo | null>("get_system_info");
export const requestMetricsRefresh = () => call<void>("request_metrics_refresh");

// Processes --------------------------------------------------------------------
export const listProcesses = () => call<ProcessInfo[]>("list_processes");
export const killProcess = (pid: number) => call<KillResult>("kill_process", { pid });

// Cleaning ---------------------------------------------------------------------
export const listCleanCategories = () => call<CleanCategoryInfo[]>("list_clean_categories");

export function scanCleanup(
  categories: string[],
  onEvent: (event: ScanEvent) => void,
): Promise<ScanSummary> {
  const channel = new Channel<ScanEvent>();
  channel.onmessage = onEvent;
  return call<ScanSummary>("scan_cleanup", { categories, onEvent: channel });
}

export function cleanFiles(
  request: CleanRequest,
  onEvent: (event: CleanEvent) => void,
): Promise<CleanSummary> {
  const channel = new Channel<CleanEvent>();
  channel.onmessage = onEvent;
  return call<CleanSummary>("clean_files", { request, onEvent: channel });
}

export const cancelCleanup = () => call<void>("cancel_cleanup");

// Recycle bin & utilities ------------------------------------------------------
export const getRecycleBinInfo = () => call<RecycleBinInfo>("get_recycle_bin_info");
export const emptyRecycleBin = () => call<RecycleBinResult>("empty_recycle_bin");
export const getUtilitiesState = () => call<UtilitiesState>("get_utilities_state");
export const setKeepAwake = (enabled: boolean) =>
  call<UtilitiesState>("set_keep_awake", { enabled });
export const setDesktopIconsVisible = (visible: boolean) =>
  call<UtilitiesState>("set_desktop_icons_visible", { visible });

// Settings ---------------------------------------------------------------------
export const getSettings = () => call<Settings>("get_settings");
export const updateSettings = (settings: Settings) =>
  call<Settings>("update_settings", { settings });
export const getAutostartEnabled = () => call<boolean>("get_autostart_enabled");

// Events -----------------------------------------------------------------------
export function onMetricsUpdate(handler: (snapshot: SystemSnapshot) => void): Promise<UnlistenFn> {
  return listen<SystemSnapshot>(EVENTS.metricsUpdate, (e) => handler(e.payload));
}

export function onMetricsError(handler: (message: string) => void): Promise<UnlistenFn> {
  return listen<string>(EVENTS.metricsError, (e) => handler(e.payload));
}

export function onNavigate(handler: (page: string) => void): Promise<UnlistenFn> {
  return listen<string>(EVENTS.navigate, (e) => handler(e.payload));
}
