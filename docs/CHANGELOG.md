[Não publicado]: https://github.com/Victorkaue333/cleanwin/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Victorkaue333/cleanwin/releases/tag/v0.1.0

# Changelog — CleanWin

Todas as mudanças relevantes deste projeto são registradas aqui.
Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · Versões: [SemVer](https://semver.org/lang/pt-BR/).

Tipos usados: Adicionado, Alterado, Corrigido, Removido, Depreciado, Segurança. Versões da mais recente para a mais antiga.

> Contexto e regras fixas: [`../CLAUDE.md`](../CLAUDE.md) · Visão geral: [`../README.md`](../README.md).
> Projeto em **desenvolvimento inicial** (pré-1.0); o contrato IPC pode mudar sem aviso entre versões menores.

## [Não publicado][Não publicado]

### Adicionado

- **Ícone sempre visível na bandeja (opt-in)** — `system/tray_icon_settings.rs` grava/remove `IsPromoted` em `HKCU\Control Panel\NotifyIconSettings\<id>` do próprio exe; comandos `get_tray_icon_promoted` / `set_tray_icon_promoted` (26 comandos); reaplicado na partida; interruptor em Configurações › Janela; novos campos `trayIconPromoted` e `onboardingShown` em `settings.json`; diálogo de primeira execução (ícone na bandeja e autostart minimizado). Ver [ADR-20](DECISIONS.md).

## [0.1.1] — 2026-11-04

### Corrigido
- Perfil de release sem `strip` total e com `opt-level = 3`, o que evitou o falso positivo `Trojan:Win32/Bearfoos!ml` do Windows Defender observado na 0.1.0 (binário passa de 4,1 MB para 8,9 MB).
- Ícone do CleanWin no instalador NSIS (`nsis.installerIcon`).

### Adicionado
- Opção "Ícone sempre visível na bandeja" (`NotifyIconSettings\IsPromoted`, opt-in) e diálogo de primeira execução (ADR-20).
- `permissions: contents: write` no CI para publicar a Release.

## [0.1.0][0.1.0] — 2026-11-04

Primeira entrega completa. Repositório nascido de um `README.md` de uma linha; tudo abaixo foi construído nesta versão.

### Adicionado

- **Núcleo Rust (Tauri 2)** — `src-tauri/`: 24 comandos IPC ([`API.md`](API.md)), estado gerenciado (`AppState`), erros `{ code, message }` (`AppError`), plugins `single-instance`, `log`, `opener`, `process`, `autostart`.
- **Métricas reais** — thread própria com `sysinfo` 0.40 + Win32: CPU global e por núcleo (dois samples na partida), memória, discos por unidade (usado = total − disponível, unidade do sistema marcada), rede por intervalo medido (loopback excluído, conectividade via `InternetGetConnectedState`), GPU via DXGI/PDH (software adapters ocultos), temperatura de GPU via NVML quando NVIDIA, sensores via WMI a cada 8 ticks, bateria via `GetSystemPowerStatus`, uptime, top 8 processos agrupados por nome, saúde (`healthy`/`attention`/`critical` com motivos). Evento `metrics:update`; intervalo ≥ 5 s com janela oculta.
- **Processos** — lista normalizada por núcleo lógico; `kill_process` com `protection_reason` (PID 0/4, o próprio app, 19 nomes críticos) e `TerminateProcess` com erro Win32 real.
- **Limpeza** — catálogo de 7 categorias (`user_temp`, `windows_temp`, `browser_cache` para Chrome/Edge/Brave/Vivaldi/Opera/Firefox, `crash_reports`, `shader_cache`, `thumbnail_cache`, `inet_cache`), `is_safe_root`, walk sem reparse points, scan sem exclusão com progresso por `Channel`, sessão de scan (30 min, uso único), exclusão revalidada arquivo a arquivo, arquivos em uso contados como `locked`, pastas vazias removidas (nunca a raiz), cancelamento cooperativo, regra "pular modificados nas últimas 24 h".
- **Utilidades** — Lixeira (`SHQueryRecycleBinW`/`SHEmptyRecycleBinW`, `wasEmpty`), manter tela ativa em thread dedicada (`SetThreadExecutionState`), ocultar/restaurar ícones da área de trabalho (`WM_COMMAND 0x7402` com confirmação de estado).
- **Configurações** — `settings.json` com escrita atômica, sanitização e `#[serde(default)]`; autostart opt-in com `--minimized` e rollback em falha; modo de janela (compacto 560×680 / completo 1120×720).
- **Bandeja e janela** — ícone com status CPU/RAM e tooltip, menu Abrir/Ocultar/Escanear lixo/Sair, clique esquerdo alterna a janela; fechar = ocultar ou sair (configurável); cleanup em `ExitRequested` (keep-awake liberado, ícones restaurados); segunda instância foca a janela.
- **Interface React 19 + TypeScript** — `src/`: stores Zustand (métricas com histórico, processos, limpeza, configurações, UI, utilidades, toasts), wrappers IPC tipados (`services/ipc.ts`, `types/ipc.ts`), i18n pt-BR/en-US, componentes base (Button, Card, Dialog, IconButton, ProgressBar, SegmentedMeter, Spinner, Toaster), tokens de `public/assets/design-tokens` em `globals.css`. *(Páginas das features em implementação na mesma entrega — ver [`qa/implementation-report.md`](qa/implementation-report.md).)*
- **Identidade visual oficial** — `public/assets/` (branding, app-icons, design-tokens, referências); ícones do app gerados a partir de `icon-1024.png`, `icon.ico` oficial no executável.
- **Distribuição** — NSIS por usuário, WebView2 bootstrapper, perfil de release otimizado; CI em `windows-latest` (typecheck, lint, Vitest, `cargo test`, Clippy, `tauri build`).
- **Testes** — Rust: settings (roundtrip, inválido, clamping, camelCase), cleaner (raízes seguras/inseguras, scan com e sem regra de 24 h, seletor por nome, limpeza só dentro da raiz, lookalikes, diretórios, arquivo ausente, arquivo bloqueado, cancelamento, sessões), processos (proteção, agrupamento), métricas (percentual, saúde, coletor real), energia, Lixeira (consulta). Frontend: Vitest + jsdom.
- **Documentação** — README no padrão AEX, `PROJECT_CONTEXT.md`, `CLAUDE.md`, canônicos em `docs/` (PRD, ARCHITECTURE, API, DATABASE, DEPLOY, ENVIRONMENT, DECISIONS, CHANGELOG, DESIGN, Code-Style, INDEX) e detalhamento em `docs/{project-context,architecture,api,development}`.

### Segurança

- Interface nunca envia caminhos para exclusão; `reveal_path` restrito a caminhos reportados pelo app; `open_external` só `http(s)`; CSP `default-src 'self'`; capability mínima para a janela `main`; nenhuma elevação, serviço, driver, telemetria ou rede.

### Decisões

- ADR-01..19 em [`DECISIONS.md`](DECISIONS.md). Destaques: loop de métricas por evento (ADR-04), limpeza por sessão (ADR-07), catálogo fixo (ADR-08), identidade visual exclusivamente de `public/assets` após rejeição do logo gerado por IA (ADR-18).

### Limitações conhecidas

- Temperatura de CPU normalmente "Não disponível" sem elevação (WMI); temperatura de GPU só NVIDIA; `C:\Windows\Temp` e `ProgramData\…\WER` parciais sem admin; instalador não assinado; sem auto-update; só x64.
