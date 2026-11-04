# Data flow

```
┌──────────────────────────── Rust (src-tauri) ────────────────────────────┐
│  metrics thread ──refresh──▶ MetricsCollector ──snapshot──▶ MetricsShared │
│        │                                                   │             │
│        └── emit "metrics:update" ──────────────┐           │ get_system_snapshot
│                                                ▼           ▼             │
│  tray.update_status (tooltip/status line)   IPC (invoke / events / channel)
└────────────────────────────────────────────────┬─────────────────────────┘
                                                 ▼
┌──────────────────────────── React (src) ──────────────────────────────────┐
│ services/ipc (typed invoke wrappers) ──▶ zustand stores ──▶ features/pages │
│   metrics store: latest snapshot + ring-buffer history (CPU, network)      │
│   processes store: list, sort, filter, pending kill confirmation           │
│   cleaning store: categories, scan progress, selection, clean progress     │
│   settings store: Settings mirror, optimistic update + rollback on error   │
│   ui store: view mode, active page, dialogs, toasts                         │
└────────────────────────────────────────────────────────────────────────────┘
```

## Startup

1. `main.rs` → `lib::run()`; plugins registered; `setup` loads `settings.json`, manages `AppState`, builds the tray and spawns the metrics thread.
2. Window is created hidden. React mounts, subscribes to `metrics:update`, loads settings and app info, then calls `frontend_ready`.
3. `frontend_ready` applies the view-mode size and shows the window unless `--minimized`/`startMinimized`.
4. Until the first `metrics:update` arrives the UI shows skeletons (no placeholder numbers).

## Monitoring loop

- Interval: `refreshIntervalMs` (500–10000, default 1500). Hidden/minimized window: max(interval, 5000 ms).
- Each tick: refresh → store in `MetricsShared` → update tray → emit event. The frontend appends to history buffers and re-renders only the subscribed slices.
- Immediate refresh requests (`request_metrics_refresh`) wake the loop early (window shown, after kill/clean/empty bin).

## Cleaning flow

```
UI: select categories ──▶ scan_cleanup(categories, channel)
      ◀── ScanEvent progress …            Rust walks roots, never deletes
      ◀── ScanSummary { sessionId, categories[] }  (file list kept in Rust)
UI: show sizes, largest files, partial/locked hints; user selects + confirms
UI ──▶ clean_files({ sessionId, categories }, channel)
      ◀── CleanEvent progress …            Rust re-validates + deletes
      ◀── CleanSummary { freedBytes, lockedFiles, failedFiles, categories[] }
UI: report; cancel_cleanup at any time (cooperative)
```

## Settings

- Source of truth: `settings.json` (atomic write). The store mirrors it; `update_settings` returns the sanitised value which replaces the frontend copy.
- Side effects applied by Rust on update: metrics interval, autostart entry, window size.

## Errors

Every rejected `invoke` is `{ code, message }`. The frontend maps `code` to a localised message and keeps `message` for the details/log. Native failures are logged by `tauri-plugin-log`.
