# Events (Rust → frontend)

Events are emitted with `tauri::Emitter::emit` and consumed with `listen` from `@tauri-apps/api/event`. The window capability grants `core:event:default`.

| Event | Payload | Emitted by | When |
|---|---|---|---|
| `metrics:update` | `SystemSnapshot` | `services/metrics_loop.rs` | Every refresh (interval from settings, 500–10000 ms; at least 5 s while the window is hidden or minimized). This is the frontend's primary data source: there is no polling. |
| `metrics:error` | `string` | `services/metrics_loop.rs` | Once, if the metrics collector could not be initialised. The UI shows an error state. |
| `navigate` | `string` (page id, e.g. `"cleaning"`) | `services/tray.rs` | Tray menu "Escanear lixo": the window is shown and the frontend must switch to that page. |

Progress of scans and cleanings does not use global events; it is streamed per call through an IPC `Channel` (see `tauri-commands.md`), which keeps the data bound to the call that requested it.

## Channel payloads

`ScanEvent` (tagged by `type`):

```json
{ "type": "categoryStarted", "id": "user_temp" }
{ "type": "progress", "id": "user_temp", "fileCount": 1200, "totalBytes": 734003200 }
{ "type": "categoryFinished", "result": { "id": "user_temp", "roots": ["C:\\Users\\me\\AppData\\Local\\Temp"], "fileCount": 1534, "totalBytes": 801234567, "skippedRecentCount": 12, "skippedRecentBytes": 1048576, "accessDeniedCount": 0, "partial": false, "largest": [ { "path": "...", "sizeBytes": 1234, "modifiedMs": 1730000000000 } ] } }
```

`CleanEvent` (tagged by `type`):

```json
{ "type": "categoryStarted", "id": "user_temp", "fileCount": 1534 }
{ "type": "progress", "id": "user_temp", "processed": 400, "deletedFiles": 390, "freedBytes": 123456, "lockedFiles": 10, "failedFiles": 0 }
{ "type": "categoryFinished", "result": { "id": "user_temp", "deletedFiles": 1500, "freedBytes": 790000000, "lockedFiles": 30, "failedFiles": 4, "missingFiles": 0, "removedDirs": 12, "errors": [ { "path": "...", "reason": "..." } ] } }
```
