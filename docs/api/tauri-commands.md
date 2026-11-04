# Tauri commands (IPC)

CleanWin has no HTTP API. The React frontend talks to the Rust core only through Tauri's IPC (`invoke`). Every command is declared in `src-tauri/src/commands/mod.rs`, registered in `src-tauri/src/lib.rs` and reachable only from the `main` window (see `src-tauri/capabilities/default.json`).

Conventions:

- Argument keys are camelCase on the JavaScript side (`invoke("kill_process", { pid })`).
- Return values are JSON with camelCase keys; the shapes live in `src-tauri/src/models/mod.rs` and are mirrored in `src/types/`.
- Failures reject with `{ code, message }` (see [Errors](#errors)).
- Long operations stream progress through `Channel` (`@tauri-apps/api/core`) and return the final summary.

## Application and window

| Command | Arguments | Returns | Notes |
|---|---|---|---|
| `frontend_ready` | — | `boolean` (window shown) | Call once after React mounts. The window is created hidden; this shows it unless the app started with `--minimized` or `startMinimized` is on. Also applies the saved view mode size. |
| `get_app_info` | — | `AppInfo` | Name, version, identifier, config dir, log dir, repository URL, `elevated`, `debug`. |
| `set_view_mode` | `mode: "compact" \| "full"` | `Settings` | Persists and resizes the window (compact 560×680, full 1120×720 logical px). |
| `hide_to_tray` | — | — | Hides the main window. |
| `exit_app` | — | — | Full exit (cleanup runs: keep-awake released, desktop icons restored). |
| `open_external` | `url: string` | — | Opens an `http(s)` URL in the default browser. Other schemes are rejected (`invalid_operation`). |
| `reveal_path` | `path: string` | — | Opens a folder in Explorer. Only paths CleanWin itself reported (config dir, log dir, scan roots) are accepted. |

## Metrics

| Command | Arguments | Returns | Notes |
|---|---|---|---|
| `get_system_snapshot` | — | `SystemSnapshot \| null` | Latest snapshot produced by the background loop (`null` before the first refresh). Rejects with `internal` if the collector failed to start. |
| `get_system_info` | — | `StaticSystemInfo \| null` | OS, host name, CPU brand/vendor, core counts, architecture, total RAM. |
| `request_metrics_refresh` | — | — | Asks the loop for an immediate refresh (used after kill/clean and when the window is shown). |

`SystemSnapshot` fields: `timestampMs`, `uptimeSecs`, `cpu` (`usagePercent`, `perCore[]`, `logicalCores`, `physicalCores`, `brand`, `frequencyMhz`), `memory` (`totalBytes`, `usedBytes`, `availableBytes`, `usagePercent`, `swapTotalBytes`, `swapUsedBytes`), `disks[]` (`mountPoint`, `name`, `fileSystem`, `kind`, `totalBytes`, `availableBytes`, `usedBytes`, `usagePercent`, `isRemovable`, `isSystem`), `gpu` (primary) and `gpus[]` (`name`, `vendor`, `usagePercent?`, `memoryTotalBytes?`, `memoryUsedBytes?`, `temperatureC?`, `temperatureSource?`), `gpuStatus` (`available` / `not_available` / `not_supported`), `temperature` (`cpuC?`, `status?`, `sensors[]`), `network` (`downloadBps`, `uploadBps`, `totalReceivedBytes`, `totalTransmittedBytes`, `connected?`, `interfaces[]`), `battery?` (`percent?`, `charging`, `onAcPower`, `remainingSecs?`), `topProcesses[]` (`ProcessGroup`), `processCount`, `health` (`level`: `healthy` / `attention` / `critical`, `reasons[]`).

Health reason codes: `cpu_high`, `cpu_critical`, `memory_high`, `memory_critical`, `disk_high`, `disk_critical`, `temperature_high`, `temperature_critical`.

## Processes

| Command | Arguments | Returns | Notes |
|---|---|---|---|
| `list_processes` | — | `ProcessInfo[]` | From the last refresh (no extra system call). `cpuPercent` is normalised by logical core count (Task Manager scale). |
| `kill_process` | `pid: number` | `KillResult` | Refuses protected processes (`protected`), maps Win32 access denied to `permission_denied`, missing pid to `not_found`. The UI must confirm before calling. |

`ProcessInfo`: `pid`, `parentPid?`, `name`, `exe?`, `cpuPercent`, `memoryBytes`, `startTimeSecs`, `protected`, `protectionReason?` (`kernel` / `self` / `critical_windows_process`).

## Cleaning

| Command | Arguments | Returns | Notes |
|---|---|---|---|
| `list_clean_categories` | — | `CleanCategoryInfo[]` | Catalogue with resolved roots, `requiresAdmin`, `closesAppsHint`, `available`. |
| `scan_cleanup` | `categories: string[]`, `onEvent: Channel<ScanEvent>` | `ScanSummary` | Read-only. Streams `categoryStarted`, `progress`, `categoryFinished`. The summary carries a `sessionId`; the full file list stays in Rust memory for 30 minutes. |
| `clean_files` | `request: { sessionId, categories[] }`, `onEvent: Channel<CleanEvent>` | `CleanSummary` | Deletes only files found by that session. Sessions are single-use. Reports deleted, locked (in use), failed and missing files per category, and empty folders removed. |
| `cancel_cleanup` | — | — | Cooperative cancellation of the running scan or clean. |

Category ids: `user_temp`, `windows_temp`, `browser_cache`, `crash_reports`, `shader_cache`, `thumbnail_cache`, `inet_cache`. Names and descriptions are localised in the frontend.

Only one scan or clean runs at a time (`busy` otherwise).

## Recycle bin and utilities

| Command | Arguments | Returns | Notes |
|---|---|---|---|
| `get_recycle_bin_info` | — | `RecycleBinInfo` (`itemCount`, `sizeBytes`) | `SHQueryRecycleBinW`. |
| `empty_recycle_bin` | — | `RecycleBinResult` (`emptied`, `wasEmpty`, `freedBytes`, `itemCount`) | `SHEmptyRecycleBinW` without the shell dialog; the app shows its own confirmation. |
| `get_utilities_state` | — | `UtilitiesState` (`keepAwake`, `desktopIconsVisible?`, `desktopIconsSupported`) | |
| `set_keep_awake` | `enabled: boolean` | `UtilitiesState` | `SetThreadExecutionState` on a dedicated thread; released on exit. |
| `set_desktop_icons_visible` | `visible: boolean` | `UtilitiesState` | Toggles Explorer's "Show desktop icons" (`WM_COMMAND 0x7402`), verified by reading the list view state back. Icons hidden by CleanWin are restored on exit. |

## Settings

| Command | Arguments | Returns | Notes |
|---|---|---|---|
| `get_settings` | — | `Settings` | |
| `update_settings` | `settings: Settings` | `Settings` (sanitised) | Persists atomically, applies the refresh interval, autostart (HKCU Run entry with `--minimized`, only when the flag changes) and the view mode. If the autostart change fails the flag is rolled back and the command rejects. |
| `get_autostart_enabled` | — | `boolean` | Real state of the autostart entry. |
| `get_tray_icon_promoted` | — | `boolean \| null` | Reads `IsPromoted` under `HKCU\Control Panel\NotifyIconSettings\<id>` for this exe. `null` while Explorer has not registered the tray icon yet. Errors: `unsupported` (non-Windows), `permission_denied`, `internal`. |
| `set_tray_icon_promoted` | `enabled: boolean` | `boolean` | Pins (`IsPromoted=1`) or unpins (value deleted) the tray icon, re-reads and returns the real state, and stores `trayIconPromoted` in `settings.json`. Errors: `not_found` (entry not registered yet; retry shortly), `unsupported`, `permission_denied`, `internal`. |

`Settings`: `launchAtStartup`, `startMinimized`, `refreshIntervalMs` (500–10000), `closeBehavior` (`minimize_to_tray` / `exit`), `viewMode`, `language` (`pt-BR` / `en-US`), `showTrayMetrics`, `reduceMotion`, `cleaning` (`skipRecentFiles`, `recentHours`, `defaultCategories[]`), `trayIconPromoted` (`boolean | null`, `null` = never chosen), `onboardingShown` (`boolean`).

## Errors

```json
{ "code": "permission_denied", "message": "pid 1234: elevated or system process" }
```

| code | Meaning |
|---|---|
| `io` | Filesystem error |
| `permission_denied` | Needs elevation / access denied |
| `not_found` | Process, session or path gone |
| `invalid_operation` | Bad input or state (e.g. expired scan session) |
| `protected` | Refused on purpose (critical process) |
| `unsupported` | Not available on this platform/hardware |
| `busy` | Another scan/clean is running |
| `cancelled` | Cancelled by the user |
| `internal` | Unexpected native failure (message has details) |
