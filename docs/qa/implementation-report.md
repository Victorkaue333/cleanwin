# Relatório de implementação — CleanWin 0.1.0

Data: 04/nov/2026 · Máquina de validação: Windows 11 Pro 10.0.26200 (x64), conta sem elevação · Rust 1.99.1 (MSVC) · Node 24 / pnpm 11 · WebView2 156.

## A. Resumo executivo

O CleanWin foi implementado de ponta a ponta: núcleo nativo em Rust (Tauri 2) com métricas reais, processos, scanner/limpeza segura, Lixeira, manter tela ativa, ícones da área de trabalho, bandeja, configurações persistentes e instalador NSIS; interface React fiel ao mockup oficial em dois modos (painel compacto e janela completa), consumindo apenas dados reais via IPC. O app abre, mostra métricas reais no primeiro segundo, responde aos comandos e gera o instalador. Não há erros críticos conhecidos. Limitações são de plataforma (temperatura de CPU, GPU não‑NVIDIA, pastas que exigem administrador) e estão registradas.

## B. Arquitetura (decisões principais)

- Tauri 2 + Rust ≥ 1.95 (`sysinfo` 0.40 com GPU via DXGI/PDH, `windows` 0.62, NVML opcional) · React 19 + TypeScript strict + Vite 8 + Tailwind 4 + Zustand.
- Loop de métricas em thread Rust → evento `metrics:update` (sem polling); intervalo ≥ 5 s com janela oculta.
- Limpeza por sessão de scan: a UI envia só ids; o Rust revalida cada arquivo contra a raiz canônica antes de excluir.
- Processos críticos protegidos no Rust; `TerminateProcess` com erro Win32 real.
- `SetThreadExecutionState` em thread dedicada; ícones da área de trabalho via `WM_COMMAND 0x7402` com verificação do estado.
- Settings em JSON atômico; única escrita no Registro = autostart opt‑in (plugin oficial).
- Detalhes: `docs/ARCHITECTURE.md`, `docs/architecture/*.md`, `docs/DECISIONS.md`.

## C. Funcionalidades

| Funcionalidade | Estado | Evidência |
|---|---|---|
| Dashboard com estado geral, CPU, RAM, armazenamento, GPU, temperatura, rede, uptime, top processos, ações rápidas | ✅ Concluída | App em execução (captura `docs/assets/screenshots/compact-dashboard.png`): CPU 54 %, RAM 71 % "ALTO", disco 66 %, GPU 3 %, rede 10,3 kB/s ↓ / 5,62 kB/s ↑, UP 4H 35M, 4 grupos de processos |
| CPU: utilização, núcleos, identificação, histórico | ✅ | `MetricsCollector`; teste `collector_produces_real_values`; página Monitoramento |
| Memória: total/usada/disponível/%, maiores consumidores | ✅ | idem; "11,28 GB de 16 GB" no painel |
| Armazenamento por unidade (usado = total − disponível) | ✅ | teste assegura `used + available == total`; "313,88 GB livres de 931 GB" |
| GPU: nome, uso, VRAM, temperatura | ◐ Parcial (plataforma) | `sysinfo::Gpus` (DXGI/PDH) mostra uso 3 % nesta máquina; temperatura só via NVML (NVIDIA) — "Não disponível" caso contrário |
| Temperatura de CPU | ◐ Parcial (plataforma) | WMI `MSAcpi_ThermalZoneTemperature` vazio sem elevação nesta máquina → UI mostra "Não disponível" (sem valor inventado) |
| Rede: download/upload reais, histórico, conectividade | ✅ | delta de bytes ÷ tempo medido; `InternetGetConnectedState` |
| Processos: lista, PID, RAM, CPU, ordenação, busca, atualização, finalizar com confirmação, proteção | ✅ | Página Processos (331 processos listados, busca por nome/PID/caminho, ordenação por memória); teste ao vivo `terminates_a_process_we_spawned` (ping.exe) e `terminate_refuses_protected_without_touching_win32` |
| Scanner (categorias, contagem, tamanho, caminhos, seleção, progresso; não exclui) | ✅ | 7 categorias reais; testes `scan_finds_files_and_skips_recent`, `name_pattern_selector…`, `catalogue_has_unique_ids_and_safe_roots`; **scan real pela UI/IPC observado no log**: 4 categorias, 42.980 arquivos, 9,2 GB em 9 s, nada excluído |
| Limpeza segura (prévia, seleção, confirmação, progresso, cancelamento, resultado, bloqueados, relatório) | ✅ (exclusão real não executada nesta validação) | testes `clean_deletes_only_inside_root_and_keeps_root`, `locked_file_is_reported_as_locked`, `cancel_stops_cleaning`, `delete_refuses_directories`; fluxo UI com confirmação. A exclusão em pastas reais do usuário não foi disparada propositalmente nesta máquina |
| Lixeira (consulta e esvaziar com confirmação) | ✅ (consulta verificada; esvaziar não disparado) | teste `query_works_on_windows`; esvaziamento é destrutivo e foi deixado para o usuário |
| Manter tela ativa | ✅ | teste ao vivo `toggles_and_restores` (API confirma); botão no painel |
| Limpar a tela (ocultar/restaurar ícones) | ✅ | teste ao vivo `hide_and_restore_desktop_icons` neste Windows 11 |
| Bandeja (ícone, abrir, ocultar, estado, sair) | ✅ (código + execução) | ícone criado no setup; instância única verificada (segunda execução focou a janela existente); clique no menu não automatizado |
| Comportamento ao fechar (ocultar na bandeja / sair) | ✅ | `WM_CLOSE` via `PostMessage`: com `minimize_to_tray` o processo continua e a janela fica oculta; com `exit` o processo encerra em < 3 s, log sem erros |
| Configurações persistentes | ✅ | 6 testes de `SettingsStore`; `settings.json` criado em `%APPDATA%\com.cleanwin.desktop` na execução |
| Painel compacto e janela completa | ✅ | capturas `compact-*.png` (576×689 incl. borda) e `full-settings.png` (1136×729) |
| Instalador Windows | ✅ | `CleanWin_0.1.0_x64-setup.exe` (NSIS, por usuário) |
| Iniciar com o Windows / minimizado | ✅ (não verificado reiniciando a sessão) | plugin autostart com `--minimized`; `frontend_ready` respeita a flag |
| Atualização automática | ❌ Não implementada (roadmap) | "Verificar atualizações" abre a página de releases |

## D. Testes executados

| Comando | Resultado |
|---|---|
| `cargo test` (src-tauri) | **28 passed**, 0 failed (settings 7, cleaner 12, processes 3, metrics 3, power 1, recycle bin 1, …) |
| `cargo test -- --ignored` | **2 passed** (ícones da área de trabalho ao vivo; término de processo ao vivo) |
| `cargo clippy --tests -- -D warnings` | limpo |
| `cargo fmt --check` | limpo |
| `pnpm typecheck` | OK |
| `pnpm lint` | 0 erros, 2 avisos `react-refresh/only-export-components` (exports auxiliares) |
| `pnpm test` (Vitest) | **9 arquivos / 51 testes** passando |
| `pnpm build` (Vite) | OK — 384 kB JS / 38 kB CSS |
| `pnpm tauri build` | OK — exe + instalador (ver E) |
| Execução real (`target\release\cleanwin.exe`) | abre em < 2 s, métricas reais, navegação, modo completo, log em `%LOCALAPPDATA%\com.cleanwin.desktop\logs\CleanWin.log` sem erros |

Nenhum teste toca pastas reais do usuário (todos usam `tempfile`). Correções feitas durante a validação: API do `sysinfo` 0.40 (`Cpu::usage`, `Deref` das coleções), 6 lints do Clippy, sincronização do modo de janela com a página Configurações (`App.tsx`), comparação canônica em `reveal_path` (o `%TEMP%` desta máquina é um caminho curto 8.3), tolerância a BOM UTF-8 no `settings.json` (Notepad/PowerShell adicionam BOM; antes o arquivo era descartado como inválido), logs de início/fim de scan e limpeza, CI fixado em pnpm 11 (versão que gerou o lockfile).

## E. Build

| Artefato | Caminho | Tamanho |
|---|---|---|
| Executável | `src-tauri\target\release\cleanwin.exe` | ≈ 4,1 MB |
| Instalador NSIS (por usuário, pt-BR/en) | `src-tauri	argeteleaseundle
sis\CleanWin_0.1.0_x64-setup.exe` — **não versionado** (asset do CI na Release; ver pendência 1) | 4,45 MiB |

Perfil release: LTO, `opt-level = "s"`, `strip`, `panic = "abort"`. Instalador não assinado (SmartScreen avisa).

## F. Pendências, limitações e riscos

1. **Temperatura de CPU**: depende de sensores WMI, normalmente ausentes sem elevação → "Não disponível". Roadmap v0.2: integração opcional com LibreHardwareMonitor.
2. **Temperatura de GPU**: só NVIDIA (NVML). AMD/Intel → "Não disponível".
3. **`C:\Windows\Temp` e `ProgramData\…\WER`**: scan parcial sem administrador (`partial: true` na UI). O app não eleva.
4. **Assinatura de código** ausente; **auto‑update** ausente (link para releases).
5. **Mockup vs. app**: sem logo do Windows no rail (marca de terceiros); ícones de processo genéricos (lucide); limiares do disco usam três cores com rótulo.
6. **Assets de referência** (`public/assets/references/*.png`, 3,3 MB) entram no bundle por estarem em `public/`; mover para `docs/` reduziria o instalador (decisão do mantenedor, pois a pasta foi fornecida como está).
7. Ações destrutivas (limpar, esvaziar Lixeira) foram validadas por testes isolados e pela UI até a confirmação; não foram executadas contra os dados reais desta máquina. Clique no menu da bandeja não automatizado.
8. Capturas pendentes: Monitoramento/Limpeza em modo completo e menu da bandeja (sem expor caminhos pessoais).
9. Verificação ao reiniciar sessão (autostart + `--minimized`) não executada.

## G. Git

Branch: `main` · a pedido do mantenedor, as alterações foram commitadas **feature por feature** na própria `main` (12 commits convencionais), sem branch e sem push. Listagem em `git log --oneline`.
