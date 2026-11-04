# Build e distribuição

## Build de produção

```powershell
pnpm install
pnpm tauri build
```

Etapas executadas:

1. `pnpm build` → `tsc -b` + Vite → `dist/` (configurado em `build.beforeBuildCommand`).
2. `cargo build --release` em `src-tauri` (perfil `release`: LTO, `opt-level = "s"`, `codegen-units = 1`, `strip`, `panic = "abort"`).
3. Bundling NSIS.

Saídas:

| Artefato | Caminho |
|---|---|
| Executável | `src-tauri\target\release\cleanwin.exe` |
| Instalador | `src-tauri\target\release\bundle\nsis\CleanWin_0.1.0_x64-setup.exe` |

## Configuração do instalador (`src-tauri/tauri.conf.json`)

- `bundle.targets = ["nsis"]` — somente NSIS (WiX/MSI exigiria download extra do toolchain).
- `nsis.installMode = "currentUser"` — instala em `%LOCALAPPDATA%\CleanWin`, sem UAC.
- `nsis.languages = ["PortugueseBR", "English"]` com seletor de idioma.
- `webviewInstallMode = downloadBootstrapper` — baixa o WebView2 Runtime só se não existir.
- Ícones: `src-tauri/icons/icon.ico` (executável/instalador) e PNGs gerados a partir de `public/assets/app-icons/icon-1024.png` via `pnpm tauri icon`.

## Versão

Alterar em três lugares, mantendo-os iguais: `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json` (`version`). O rodapé da interface lê a versão do `tauri.conf.json` via `get_app_info`.

## Assinatura de código

Não configurada nesta versão: o SmartScreen mostra o aviso "editor desconhecido" na primeira execução. Para assinar, defina `bundle.windows.certificateThumbprint` / `signCommand` conforme a documentação do Tauri e assine também o instalador.

## CI

`.github/workflows/ci.yml` roda em `windows-latest`: typecheck, lint, Vitest, `cargo test`, `cargo clippy -D warnings` e `pnpm tauri build`, publicando o instalador como artefato do workflow. Releases devem ser criadas a partir de uma tag `v*` com esse artefato.
