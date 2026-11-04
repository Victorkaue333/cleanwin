/**
 * TypeScript mirror of `src-tauri/src/models/mod.rs` and
 * `src-tauri/src/services/settings.rs`. Keys are camelCase (serde rename_all).
 */

export type AvailabilityStatus = "available" | "not_available" | "not_supported";
export type HealthLevel = "healthy" | "attention" | "critical";

export interface CpuMetrics {
  usagePercent: number;
  perCore: number[];
  logicalCores: number;
  physicalCores: number | null;
  brand: string;
  frequencyMhz: number;
}

export interface MemoryMetrics {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
}

export interface DiskMetrics {
  mountPoint: string;
  name: string;
  fileSystem: string;
  kind: string;
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  usagePercent: number;
  isRemovable: boolean;
  isSystem: boolean;
}

export interface GpuMetrics {
  name: string;
  vendor: string | null;
  usagePercent: number | null;
  memoryTotalBytes: number | null;
  memoryUsedBytes: number | null;
  temperatureC: number | null;
  temperatureSource: string | null;
}

export interface SensorReading {
  label: string;
  valueC: number;
}

export interface TemperatureMetrics {
  cpuC: number | null;
  status: AvailabilityStatus | null;
  sensors: SensorReading[];
}

export interface NetworkInterfaceMetrics {
  name: string;
  downloadBps: number;
  uploadBps: number;
}

export interface NetworkMetrics {
  downloadBps: number;
  uploadBps: number;
  totalReceivedBytes: number;
  totalTransmittedBytes: number;
  connected: boolean | null;
  interfaces: NetworkInterfaceMetrics[];
}

export interface BatteryMetrics {
  percent: number | null;
  charging: boolean;
  onAcPower: boolean;
  remainingSecs: number | null;
}

export interface HealthStatus {
  level: HealthLevel;
  reasons: string[];
}

export interface ProcessGroup {
  name: string;
  pids: number[];
  cpuPercent: number;
  memoryBytes: number;
  protected: boolean;
  exe: string | null;
}

export interface SystemSnapshot {
  timestampMs: number;
  uptimeSecs: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disks: DiskMetrics[];
  gpu: GpuMetrics | null;
  gpus: GpuMetrics[];
  gpuStatus: AvailabilityStatus;
  temperature: TemperatureMetrics;
  network: NetworkMetrics;
  battery: BatteryMetrics | null;
  topProcesses: ProcessGroup[];
  processCount: number;
  health: HealthStatus;
}

export interface StaticSystemInfo {
  osName: string;
  osVersion: string;
  kernelVersion: string;
  hostName: string;
  cpuBrand: string;
  cpuVendor: string;
  logicalCores: number;
  physicalCores: number | null;
  arch: string;
  totalMemoryBytes: number;
}

export type ProtectionReason = "kernel" | "self" | "critical_windows_process";

export interface ProcessInfo {
  pid: number;
  parentPid: number | null;
  name: string;
  exe: string | null;
  cpuPercent: number;
  memoryBytes: number;
  startTimeSecs: number;
  protected: boolean;
  protectionReason: ProtectionReason | string | null;
}

export interface KillResult {
  pid: number;
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Cleaning
// ---------------------------------------------------------------------------

export type CleanCategoryId =
  | "user_temp"
  | "windows_temp"
  | "browser_cache"
  | "crash_reports"
  | "shader_cache"
  | "thumbnail_cache"
  | "inet_cache";

export interface CleanCategoryInfo {
  id: CleanCategoryId | string;
  roots: string[];
  requiresAdmin: boolean;
  closesAppsHint: boolean;
  available: boolean;
}

export interface FileEntry {
  path: string;
  sizeBytes: number;
  modifiedMs: number | null;
}

export interface ScanCategoryResult {
  id: string;
  roots: string[];
  fileCount: number;
  totalBytes: number;
  skippedRecentCount: number;
  skippedRecentBytes: number;
  accessDeniedCount: number;
  partial: boolean;
  largest: FileEntry[];
}

export interface ScanSummary {
  sessionId: string;
  durationMs: number;
  categories: ScanCategoryResult[];
  totalFiles: number;
  totalBytes: number;
  cancelled: boolean;
}

export type ScanEvent =
  | { type: "categoryStarted"; id: string }
  | { type: "progress"; id: string; fileCount: number; totalBytes: number }
  | { type: "categoryFinished"; result: ScanCategoryResult };

export interface CleanRequest {
  sessionId: string;
  categories: string[];
}

export interface FileError {
  path: string;
  reason: string;
}

export interface CleanCategoryResult {
  id: string;
  deletedFiles: number;
  freedBytes: number;
  lockedFiles: number;
  failedFiles: number;
  missingFiles: number;
  removedDirs: number;
  errors: FileError[];
}

export interface CleanSummary {
  durationMs: number;
  deletedFiles: number;
  freedBytes: number;
  lockedFiles: number;
  failedFiles: number;
  categories: CleanCategoryResult[];
  cancelled: boolean;
}

export type CleanEvent =
  | { type: "categoryStarted"; id: string; fileCount: number }
  | {
      type: "progress";
      id: string;
      processed: number;
      deletedFiles: number;
      freedBytes: number;
      lockedFiles: number;
      failedFiles: number;
    }
  | { type: "categoryFinished"; result: CleanCategoryResult };

// ---------------------------------------------------------------------------
// Utilities, settings, app
// ---------------------------------------------------------------------------

export interface RecycleBinInfo {
  itemCount: number;
  sizeBytes: number;
}

export interface RecycleBinResult {
  emptied: boolean;
  wasEmpty: boolean;
  freedBytes: number;
  itemCount: number;
}

export interface UtilitiesState {
  keepAwake: boolean;
  desktopIconsVisible: boolean | null;
  desktopIconsSupported: boolean;
}

export type CloseBehavior = "minimize_to_tray" | "exit";
export type ViewMode = "compact" | "full";
export type Language = "pt-BR" | "en-US";

export interface CleaningSettings {
  skipRecentFiles: boolean;
  recentHours: number;
  defaultCategories: string[];
}

export interface Settings {
  launchAtStartup: boolean;
  startMinimized: boolean;
  refreshIntervalMs: number;
  closeBehavior: CloseBehavior;
  viewMode: ViewMode;
  language: Language;
  showTrayMetrics: boolean;
  reduceMotion: boolean;
  cleaning: CleaningSettings;
  /** `null` = the user never chose. */
  trayIconPromoted: boolean | null;
  onboardingShown: boolean;
}

export interface AppInfo {
  name: string;
  version: string;
  identifier: string;
  configDir: string;
  logDir: string;
  repository: string;
  elevated: boolean;
  debug: boolean;
}

export type AppErrorCode =
  | "io"
  | "permission_denied"
  | "not_found"
  | "invalid_operation"
  | "protected"
  | "unsupported"
  | "busy"
  | "cancelled"
  | "internal";

export interface AppErrorPayload {
  code: AppErrorCode;
  message: string;
}
