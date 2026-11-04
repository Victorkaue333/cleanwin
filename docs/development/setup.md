# Ambiente de desenvolvimento

## Requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Windows | 10 (1803+) ou 11, x64 | WebView2 Runtime já incluso; o instalador baixa se faltar |
| Node.js | 20+ (testado com 24) | |
| pnpm | 9+ (testado com 11) | `corepack enable` ou `npm i -g pnpm` |
| Rust (stable, MSVC) | **≥ 1.95** (testado com 1.99.1) | `rustup update stable`; `sysinfo 0.40` exige 1.95 |
| Visual Studio Build Tools 2022 | C++ build tools + Windows 10/11 SDK | exigido pelo toolchain MSVC e pelo `windows` crate |
| Tauri CLI | instalada pelo `pnpm install` (`@tauri-apps/cli`) | não precisa de `cargo install tauri-cli` |

## Primeiros passos

```powershell
git clone https://github.com/Victorkaue333/cleanwin.git
cd cleanwin
pnpm install          # frontend + Tauri CLI
pnpm tauri dev        # compila o Rust (a primeira vez demora alguns minutos) e abre a janela com HMR
```

`pnpm tauri dev` roda `pnpm dev` (Vite em `http://localhost:1420`) automaticamente (`build.beforeDevCommand`).

## Scripts

| Script | O que faz |
|---|---|
| `pnpm dev` | Vite apenas (útil para trabalhar na UI sem o Rust; as chamadas IPC falham fora do Tauri) |
| `pnpm typecheck` | `tsc -b --noEmit` |
| `pnpm lint` | ESLint (TypeScript + React hooks) |
| `pnpm test` / `pnpm test:watch` | Vitest (jsdom) |
| `pnpm build` | Build de produção do frontend em `dist/` |
| `pnpm test:rust` | `cargo test` em `src-tauri` |
| `pnpm tauri build` | Executável + instalador NSIS (ver `build.md`) |

## Onde ficam os arquivos em tempo de execução

| Item | Caminho |
|---|---|
| Configurações | `%APPDATA%\com.cleanwin.desktop\settings.json` |
| Logs | `%LOCALAPPDATA%\com.cleanwin.desktop\logs\` |
| Entrada de autostart (opt-in) | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\CleanWin` → `"…\cleanwin.exe" --minimized` |

## Dicas

- O Rust loga em `stdout` no modo dev e no diretório de logs (nível `debug` em dev, `info` em release).
- Para testar o modo "iniciar minimizado": `src-tauri\target\debug\cleanwin.exe --minimized`.
- Alterações em `src-tauri/**` recompilam o Rust; alterações em `src/**` recarregam via HMR.
- `src-tauri/gen/schemas/` é gerado (ignorado pelo git) e dá autocompletar para `capabilities/*.json`.
