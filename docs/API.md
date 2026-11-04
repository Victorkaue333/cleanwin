# API — CleanWin

> Camada **autoritativa e concisa** do contrato entre interface e núcleo. Documenta o que o Rust expõe (comandos, eventos, canais), refletindo o **código real** (`src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/models/mod.rs`). Campo a campo: [`api/tauri-commands.md`](api/tauri-commands.md) · [`api/events.md`](api/events.md).
> Fontes: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`DATABASE.md`](DATABASE.md) · [`PRD.md`](PRD.md) · [`../CLAUDE.md`](../CLAUDE.md).
> Última atualização: 04/nov/2026 · Verificado contra o código-fonte (26 comandos registrados em `generate_handler!`).

## Visão geral

- **Não há API HTTP.** Toda comunicação é o IPC do Tauri 2: `invoke` (`@tauri-apps/api/core`), eventos (`@tauri-apps/api/event`) e `Channel` (progresso por chamada).
- **Alcance:** só a janela `main` (`src-tauri/capabilities/default.json`). Nenhum comando é alcançável de fora do processo.
- **Formato:** JSON; chaves **camelCase** dos dois lados (`#[serde(rename_all = "camelCase")]` no Rust, `src/types/ipc.ts` no TS). Argumentos de `invoke` também em camelCase (`{ pid }`, `{ sessionId }`).
- **Versionamento:** nenhum — interface e núcleo são compilados juntos no mesmo binário.

## Autenticação

Não há contas nem tokens. O que substitui "autorização" é a **capability** da janela (`core:default`, controles de janela para a barra de título customizada, `core:event:default`, `opener:default`, `autostart:default`, `process:default`) e a **validação no Rust** de cada comando sensível:

| Guarda | Significado |
|--------|-------------|
| `protected` | PID 0/4, o próprio CleanWin e `PROTECTED_NAMES` (`csrss`, `wininit`, `winlogon`, `services`, `lsass`, `lsaiso`, `svchost`, `dwm`, `smss`, `fontdrvhost`, `sihost`, `ntoskrnl`, `MsMpEng`, `WUDFHost`, `audiodg`, `System`, `Registry`, `Memory Compression`, `Secure System`) nunca são finalizados |
| sessão de scan | `clean_files` só aceita o `sessionId` da última `scan_cleanup`, válido por 30 min e de uso único; categorias fora da sessão são ignoradas |
| raiz canônica | cada arquivo é revalidado (regular, sem reparse point, `starts_with` da raiz canônica) antes do `remove_file` |
| `busy` | só um scan/limpeza por vez (`CleanerState::begin`) |
| allowlist | `open_external` só `http(s)`; `reveal_path` só config dir, log dir e raízes do catálogo |

## Convenções

- Comandos síncronos respondem direto; os que tocam disco ou shell (`kill_process`, `scan_cleanup`, `clean_files`, `get_recycle_bin_info`, `empty_recycle_bin`) são `async` e rodam em `tauri::async_runtime::spawn_blocking`.
- Progresso **nunca** vai por evento global: `scan_cleanup` e `clean_files` recebem um `Channel` e emitem payloads tagueados por `type`.
- Toda rejeição é `{ code, message }`:

| `code` | Significado |
|---|---|
| `io` | Erro de sistema de arquivos |
| `permission_denied` | Precisa de elevação / acesso negado (Win32 `ERROR_ACCESS_DENIED`) |
| `not_found` | Processo, sessão ou caminho inexistente |
| `invalid_operation` | Entrada ou estado inválido (ex.: sessão expirada, URL não-http) |
| `protected` | Recusado de propósito (processo crítico) |
| `unsupported` | Indisponível na plataforma/hardware |
| `busy` | Outro scan/limpeza em andamento |
| `cancelled` | Cancelado pelo usuário |
| `internal` | Falha nativa inesperada (mensagem com detalhe) |

- Bytes sempre em `u64` (bytes crus); percentuais em `f32` 0–100; tempos em segundos (`uptimeSecs`, `startTimeSecs`) ou milissegundos desde a época (`timestampMs`, `modifiedMs`).

## Comandos

Nome do `invoke` = nome da função Rust. Guarda = enforcement real no código.

### `app` — janela e aplicativo

| Comando | Guarda | Descrição |
|---|---|---|
| `frontend_ready()` → `boolean` | — | Chamar **uma vez** após o mount. Aplica o tamanho do modo salvo e mostra a janela (criada oculta), exceto com `--minimized` ou `startMinimized` |
| `get_app_info()` → `AppInfo` | — | `name`, `version`, `identifier`, `configDir`, `logDir`, `repository`, `elevated` (token), `debug` |
| `set_view_mode({ mode })` → `Settings` | — | `"compact"` (560×680, mín. 520×600) ou `"full"` (1120×720, mín. 940×620); persiste e redimensiona |
| `hide_to_tray()` | — | Oculta a janela |
| `exit_app()` | — | Saída completa com cleanup (keep-awake liberado, ícones restaurados) |
| `open_external({ url })` | allowlist `http(s)` | Abre no navegador padrão |
| `reveal_path({ path })` | allowlist | Abre a pasta no Explorer (só caminhos que o app reportou) |

### `metrics` — métricas

| Comando | Guarda | Descrição |
|---|---|---|
| `get_system_snapshot()` → `SystemSnapshot \| null` | — | Último snapshot da thread de métricas (`null` antes do primeiro); rejeita `internal` se o coletor falhou ao iniciar |
| `get_system_info()` → `StaticSystemInfo \| null` | — | SO, versão, kernel, host, CPU (marca/fabricante/núcleos), arquitetura, RAM total |
| `request_metrics_refresh()` | — | Acorda a thread para um refresh imediato |

### `processes` — processos

| Comando | Guarda | Descrição |
|---|---|---|
| `list_processes()` → `ProcessInfo[]` | — | Lista do último refresh (`cpuPercent` normalizado por núcleo lógico) |
| `kill_process({ pid })` → `KillResult` | `protected` | `OpenProcess(PROCESS_TERMINATE)` + `TerminateProcess`; `permission_denied` / `not_found` mapeados do Win32. **A UI confirma antes** |

### `cleaning` — limpeza

| Comando | Guarda | Descrição |
|---|---|---|
| `list_clean_categories()` → `CleanCategoryInfo[]` | — | Catálogo resolvido: `id`, `roots[]`, `requiresAdmin`, `closesAppsHint`, `available` |
| `scan_cleanup({ categories, onEvent })` → `ScanSummary` | `busy` | Somente leitura. Emite `ScanEvent` (`categoryStarted` · `progress` · `categoryFinished`); devolve `sessionId`, totais e os 40 maiores arquivos por categoria |
| `clean_files({ request: { sessionId, categories }, onEvent })` → `CleanSummary` | sessão + raiz canônica + `busy` | Apaga só o que a sessão listou; `CleanEvent` com apagados/em uso/falhas; remove pastas vazias (nunca a raiz) |
| `cancel_cleanup()` | — | Cancelamento cooperativo do scan/limpeza em curso |

Categorias: `user_temp` · `windows_temp` (parcial sem admin) · `browser_cache` (Chrome, Edge, Brave, Vivaldi, Opera, Firefox) · `crash_reports` (CrashDumps + WER) · `shader_cache` (D3DSCache, NVIDIA, AMD, Intel) · `thumbnail_cache` (`thumbcache_*.db`, `iconcache_*.db`) · `inet_cache` (INetCache). Arquivos modificados nas últimas `recentHours` (padrão 24) são pulados nas categorias de temp/cache quando `skipRecentFiles` está ligado.

### `utilities` — Lixeira e utilidades

| Comando | Guarda | Descrição |
|---|---|---|
| `get_recycle_bin_info()` → `RecycleBinInfo` | — | `SHQueryRecycleBinW`: `itemCount`, `sizeBytes` |
| `empty_recycle_bin()` → `RecycleBinResult` | — | `SHEmptyRecycleBinW` sem diálogo/som do shell (a UI confirma); `wasEmpty` quando já vazia |
| `get_utilities_state()` → `UtilitiesState` | — | `keepAwake`, `desktopIconsVisible?`, `desktopIconsSupported` |
| `set_keep_awake({ enabled })` → `UtilitiesState` | — | `SetThreadExecutionState` em thread dedicada; liberado ao sair |
| `set_desktop_icons_visible({ visible })` → `UtilitiesState` | — | `WM_COMMAND 0x7402` para `SHELLDLL_DefView`, estado relido para confirmar; restaurado ao sair se o app ocultou |

### `settings` — configurações

| Comando | Guarda | Descrição |
|---|---|---|
| `get_settings()` → `Settings` | — | Cópia em memória de `settings.json` |
| `update_settings({ settings })` → `Settings` | — | Sanitiza, persiste atomicamente, aplica intervalo, autostart (só quando o flag muda; rollback + `internal` se falhar) e modo de janela |
| `get_autostart_enabled()` → `boolean` | — | Estado real da entrada `HKCU\…\Run` |
| `get_tray_icon_promoted()` → `boolean \| null` | — | Lê `IsPromoted` de `HKCU\Control Panel\NotifyIconSettings\<id>` (entrada cujo `ExecutablePath` é este exe). `null` = o Explorer ainda não registrou o ícone. Erros: `unsupported` (fora do Windows), `permission_denied`, `internal` |
| `set_tray_icon_promoted({ enabled })` → `boolean` | — | `enabled` grava `IsPromoted=1`; desligar remove o valor. Relê e devolve o estado real; persiste `trayIconPromoted` em `settings.json`. Erros: `not_found` (entrada ainda não registrada — repetir em instantes), `unsupported`, `permission_denied`, `internal` |

#### Exemplo detalhado — `scan_cleanup` + `clean_files`

```ts
import { invoke, Channel } from "@tauri-apps/api/core";

const onScan = new Channel<ScanEvent>();
onScan.onmessage = (e) => { if (e.type === "progress") setProgress(e.id, e.fileCount, e.totalBytes); };
const scan = await invoke<ScanSummary>("scan_cleanup", { categories: ["user_temp", "crash_reports"], onEvent: onScan });

// usuário revê scan.categories[].largest, seleciona e confirma
const onClean = new Channel<CleanEvent>();
const result = await invoke<CleanSummary>("clean_files", {
  request: { sessionId: scan.sessionId, categories: ["user_temp"] },
  onEvent: onClean,
});
// result.freedBytes · result.lockedFiles · result.categories[].errors
```

**Resposta — `ScanSummary`**

```json
{ "sessionId": "scan-1a2b…-1234", "durationMs": 812, "totalFiles": 1534, "totalBytes": 801234567, "cancelled": false,
  "categories": [ { "id": "user_temp", "roots": ["C:\\Users\\me\\AppData\\Local\\Temp"], "fileCount": 1534, "totalBytes": 801234567,
    "skippedRecentCount": 12, "skippedRecentBytes": 1048576, "accessDeniedCount": 0, "partial": false,
    "largest": [ { "path": "C:\\…\\big.tmp", "sizeBytes": 73400320, "modifiedMs": 1730000000000 } ] } ] }
```

**Erro — sessão expirada**

```json
{ "code": "invalid_operation", "message": "invalid operation: scan results expired, run a new scan" }
```

## Eventos

| Evento | Payload | Quando |
|---|---|---|
| `metrics:update` | `SystemSnapshot` | A cada intervalo (500–10 000 ms; ≥ 5 s com janela oculta/minimizada). **Fonte primária da interface** |
| `metrics:error` | `string` | Uma vez, se o coletor não iniciar |
| `navigate` | `string` (`"cleaning"`) | Bandeja → "Escanear lixo" |

`SystemSnapshot` (resumo): `timestampMs`, `uptimeSecs`, `cpu{usagePercent, perCore[], logicalCores, physicalCores?, brand, frequencyMhz}`, `memory{totalBytes, usedBytes, availableBytes, usagePercent, swap…}`, `disks[]{mountPoint, name, fileSystem, kind, totalBytes, availableBytes, usedBytes, usagePercent, isRemovable, isSystem}`, `gpu?`/`gpus[]{name, vendor?, usagePercent?, memoryTotalBytes?, memoryUsedBytes?, temperatureC?, temperatureSource?}`, `gpuStatus` (`available`/`not_available`/`not_supported`), `temperature{cpuC?, status?, sensors[]}`, `network{downloadBps, uploadBps, totalReceivedBytes, totalTransmittedBytes, connected?, interfaces[]}`, `battery?{percent?, charging, onAcPower, remainingSecs?}`, `topProcesses[]` (grupos por nome), `processCount`, `health{level, reasons[]}`.

Saúde: `healthy` · `attention` (CPU ≥ 75 %, RAM ≥ 80 %, disco ≥ 90 %, temperatura ≥ 85 °C) · `critical` (CPU ≥ 90 %, RAM ≥ 92 %, disco ≥ 95 %, temperatura ≥ 95 °C), com `reasons` (`cpu_high`, `memory_critical`, …).

---

Detalhe campo a campo: [`api/tauri-commands.md`](api/tauri-commands.md) · Payloads dos canais: [`api/events.md`](api/events.md) · Tipos TS: `src/types/ipc.ts` · DTOs Rust: `src-tauri/src/models/mod.rs`
