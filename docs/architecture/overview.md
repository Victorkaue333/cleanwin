# Architecture overview

CleanWin is a Tauri 2 desktop application: a Rust core that owns every interaction with Windows, and a React/TypeScript interface rendered by WebView2. There is no web server, no database and no network service.

```
┌────────────────────────────┐     IPC (invoke, events, channels)     ┌───────────────────────────┐
│  React + TypeScript (src/) │ ◀──────────────────────────────────▶  │  Rust core (src-tauri/)    │
│  Vite · Tailwind · Zustand │                                        │  sysinfo · windows · NVML  │
│  compact panel / full view │                                        │  cleaner · processes · tray│
└────────────────────────────┘                                        └─────────────┬─────────────┘
                                                                                     │ Win32 / Shell / WMI / DXGI / PDH
                                                                                     ▼
                                                                              Windows 10 / 11
```

## Responsibilities

| Layer | Owns | Never does |
|---|---|---|
| Frontend | Presentation, navigation, formatting, confirmation dialogs, local UI state, history buffers for charts | Touch the filesystem, processes or registry; invent data |
| Rust core | Metrics, process list/termination, scanning/deleting, recycle bin, power state, desktop icons, settings file, tray, window lifecycle | Trust paths from the UI; run shell commands; elevate |

## Key decisions (details in `docs/project-context/decisions.md`)

- **Push, not poll.** One background thread samples the system and emits `metrics:update`; the UI only listens. Hidden window ⇒ slower sampling, never zero (tray tooltip).
- **Session-based cleaning.** The scan result (file list) stays in Rust; the UI refers to it by id. Deletion re-validates every file against canonical roots.
- **Two presentations, one code base.** Compact panel (default, 560×680) and full window (1120×720) share pages and components; the mode is a persisted setting and resizes the native window.
- **Honest unavailability.** GPU, temperatures and battery are `null`/"not available" when the hardware or driver does not expose them. No synthetic numbers.
- **Local JSON settings** with atomic writes; no database.

## Repository layout

```
cleanwin/
├── src/                 React app (features, components, stores, services, i18n, types)
├── src-tauri/           Rust core, Tauri config, capabilities, icons
├── public/assets/       official branding, app icons, design tokens, references
├── docs/                project context, architecture, API, development, QA
├── tests/               Vitest setup
└── .github/             CI workflow and issue templates
```

See `frontend.md`, `native-backend.md`, `data-flow.md` and `security.md` for each part.
