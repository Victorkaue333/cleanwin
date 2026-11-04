# Native backend (Rust)

Crate: `src-tauri` (`cleanwin_lib`). Tauri 2, Rust ≥ 1.95, Windows x64.

## Modules

```
src-tauri/src/
├── lib.rs                 plugins, managed state, window/exit lifecycle, command registry
├── main.rs                binary entry (no console window in release)
├── commands/mod.rs        every #[tauri::command]; input validation; blocking work offloaded
├── errors/mod.rs          AppError { code, message } serialised for the frontend
├── models/mod.rs          serde DTOs (camelCase) mirrored by src/types
├── services/
│   ├── settings.rs        Settings + SettingsStore (atomic JSON file)
│   ├── metrics_loop.rs    background thread, MetricsShared, metrics:update event
│   ├── tray.rs            tray icon, menu, live status line
│   └── window.rs          show/hide/toggle, view-mode sizes, exit + cleanup
└── system/
    ├── metrics.rs         MetricsCollector (sysinfo + Win32), health evaluation
    ├── processes.rs       ProcessInfo mapping, grouping, protected list, TerminateProcess
    ├── cleaner.rs         category catalogue, scanner, safe deletion, scan sessions
    ├── recycle_bin.rs     SHQueryRecycleBinW / SHEmptyRecycleBinW
    ├── power.rs           keep-awake thread (SetThreadExecutionState)
    └── desktop.rs         desktop icons toggle (WM_COMMAND 0x7402 to SHELLDLL_DefView)
```

## Managed state

`services::AppState` is created in `setup` and lives for the whole process:

- `settings: SettingsStore` — in-memory copy guarded by a mutex, persisted on every change.
- `metrics: Arc<MetricsShared>` — latest snapshot, last process list, static info, interval, refresh request flag.
- `cleaner: CleanerState` — `running` guard, shared `cancel` flag, the single current `ScanSession`.
- `keep_awake: KeepAwake` — owns the dedicated execution-state thread.
- `desktop: DesktopIcons` — remembers whether CleanWin hid the icons.
- flags: `launched_minimized`, `window_revealed`, `exiting`.

## Metrics collection

`MetricsCollector` keeps one `sysinfo::System`, `Disks`, `Networks`, `Components`, `Gpus` and an optional NVML handle. The loop thread refreshes them in place every interval:

- CPU: `refresh_cpu_all` (global + per core). The first two samples are taken 250 ms apart at startup so the first snapshot already has real values.
- Memory: `refresh_memory` (total/used/available/swap).
- Processes: `refresh_processes_specifics(All, remove_dead=true, cpu + memory + exe once)`. Per-process CPU is divided by the logical core count so it matches Task Manager.
- Disks: `Disks::refresh(true)`; used = total − available; the system drive is flagged.
- Network: byte deltas divided by the measured elapsed time (not the configured interval); loopback adapters excluded; connectivity via `InternetGetConnectedState`.
- GPU: `sysinfo::Gpus` (DXGI adapter enumeration, PDH `GPU Engine` counters, video memory). Software adapters ("Microsoft Basic Render Driver") are hidden. Temperature only from NVML when an NVIDIA driver is present; otherwise `temperatureC` is `null`.
- Temperature (CPU/board): `sysinfo::Components` (WMI `MSAcpi_ThermalZoneTemperature`), refreshed every 8th tick because WMI is slow. On most consumer machines this is empty without elevation and the UI shows "Não disponível".
- Battery: `GetSystemPowerStatus`; absent on desktops.
- Uptime: `System::uptime()`.
- Health: thresholds in `metrics::health` (CPU ≥ 75/90 %, RAM ≥ 80/92 %, disk ≥ 90/95 %, temperature ≥ 85/95 °C).

When the window is hidden or minimized the loop stretches the interval to at least 5 s (the tray tooltip still updates) instead of stopping.

## Processes

Termination opens the target with `PROCESS_TERMINATE` and calls `TerminateProcess`, so the real Win32 error is reported (access denied → `permission_denied`). Before that, `protection_reason` refuses pid 0/4, CleanWin itself and a fixed list of critical Windows processes (`csrss`, `wininit`, `winlogon`, `services`, `lsass`, `svchost`, `dwm`, `smss`, `fontdrvhost`, `Memory Compression`, `Registry`, `Secure System`, `MsMpEng`, …). The frontend shows those rows as protected and never offers the action.

## Cleaner

See the module header of `system/cleaner.rs` for the full safety model. In short: fixed catalogue of roots (user temp, Windows temp, browser caches, crash reports/WER, shader caches, Explorer thumbnail cache, WinINet cache), `is_safe_root` guard, no reparse-point traversal, scan ≠ delete, deletion re-validates each file (regular file, canonical path inside the canonical root), files in use are counted as locked, empty directories removed bottom-up but never the root, cooperative cancellation. The frontend never sends paths to delete, only the scan session id and category ids.

## Shell helpers

- Recycle bin: `SHQueryRecycleBinW` for count/size, `SHEmptyRecycleBinW` with `NOCONFIRMATION | NOPROGRESSUI | NOSOUND` (CleanWin shows its own confirmation first). An already-empty bin is reported as `wasEmpty`.
- Keep awake: `ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED` set from a dedicated thread (the flag is per-thread); cleared on disable, on `shutdown` and when the thread ends.
- Desktop icons: finds `SHELLDLL_DefView` under `Progman` or a `WorkerW`, reads `IsWindowVisible` of its `SysListView32`, sends `WM_COMMAND 0x7402`, then re-reads the state to confirm. Restored on exit if CleanWin hid them.

## Lifecycle

- Single instance plugin (registered first) focuses the running window on a second launch.
- The window is created hidden; `frontend_ready` shows it unless `--minimized` / `startMinimized`.
- Close button: `CloseRequested` is intercepted; `minimize_to_tray` hides the window, `exit` goes through `request_exit`.
- `RunEvent::ExitRequested` / `Exit`: `window::cleanup` releases keep-awake and restores desktop icons.
- Logging: `tauri-plugin-log` to stdout and the app log dir (`%LOCALAPPDATA%\com.cleanwin.desktop\logs`), 2 MB rotation.
