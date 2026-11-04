# Security model

CleanWin performs sensitive operations (deleting files, terminating processes, changing power behaviour). The rules below are enforced in code, not only in the UI.

## Principle of least privilege

- The app runs as the current user. No manifest-level elevation, no service, no driver.
- The installer is per-user (`nsis.installMode = currentUser`): no UAC prompt, no `Program Files` write.
- Locations that need elevation (`C:\Windows\Temp`, `ProgramData\…\WER`) are scanned with whatever access the user has; denied entries are counted (`accessDeniedCount`, `partial: true`) and the UI says the result is partial. CleanWin never asks for elevation to finish a clean.
- Autostart is opt-in and writes a single `HKCU\…\Run` value through the official Tauri plugin. It is the only registry write in the app and it is removed when the setting is turned off.

## IPC surface

- Only the commands listed in `docs/api/tauri-commands.md` exist; the capability file grants the `main` window just those plugins/permissions (`core:default`, window controls for the custom title bar, events, opener, autostart, process).
- CSP: `default-src 'self'`; no remote scripts, no eval, no external connections.
- The frontend never passes file paths to delete. It passes category ids and a scan session id; the file list is the one Rust produced itself, valid for 30 minutes and consumed once.
- `reveal_path` only accepts paths CleanWin reported (config/log dirs, scan roots). `open_external` only accepts `http(s)`.
- Errors carry a code and a technical message, never a stack trace.

## Cleaning safety (`system/cleaner.rs`)

1. Fixed catalogue of roots; nothing user-supplied.
2. `is_safe_root`: absolute, deep enough, never a drive root, user profile, `Windows`, `System32`, `Program Files`, `ProgramData` root, personal folders (Desktop/Documents/Downloads/…); under `Windows` only `Temp`.
3. Walk uses `symlink_metadata` and skips reparse points / symlinks, so junctions cannot redirect the scan.
4. Scan never deletes. Clean re-checks each file: still a regular file, canonical path `starts_with` the canonical root (component-wise, so `Temp2` never matches `Temp`), then `remove_file`. Directories are only removed when empty and never the root.
5. Sharing/lock violations (in use) and access-denied files are reported, never forced, no process is killed to free them.
6. Files modified within the last N hours (default 24) are skipped in temp/cache categories.
7. Everything is confirmed explicitly in the UI before `clean_files` is called; the request names the exact categories.
8. No generic delete commands, no shell execution, no scripts.

## Processes

- Confirmation required in the UI.
- Protected set refused in Rust regardless of the UI: pid 0/4, CleanWin itself, critical Windows processes.
- `TerminateProcess` only; no injection, no debugging privileges.
- Nothing is killed automatically; CleanWin does not do "RAM optimisation".

## Other operations

- Keep awake only changes the execution state of CleanWin's own thread and is always released on exit.
- "Limpar a tela" only toggles Explorer's icon visibility (same message as the context menu); no file is touched and the state is restored on exit.
- Recycle bin emptying is permanent; the UI shows the item count and size and requires confirmation.

## Data and telemetry

- No network calls except the user-triggered "check for updates" link that opens the GitHub releases page in the browser.
- Settings are a local JSON file; logs are local and rotate at 2 MB.
- No analytics, crash reporting or telemetry of any kind.

## Supply chain

- Dependencies are the Tauri crates/plugins, `sysinfo`, `windows`, `nvml-wrapper`, `serde`, `thiserror`, `log`; frontend: React, Zustand, Tailwind, lucide-react, Tauri API. Versions are pinned by `Cargo.lock` / `pnpm-lock.yaml`.
- The release build is not code-signed yet (see roadmap); SmartScreen will warn on first run.
