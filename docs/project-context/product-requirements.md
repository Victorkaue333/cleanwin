# Requisitos do produto

Legenda de estado: ✅ implementado · ◐ parcial (limitação de plataforma) · ⏳ roadmap.

## Funcionais

| ID | Requisito | Estado | Onde |
|---|---|---|---|
| RF-01 | Dashboard com estado geral, CPU, RAM, armazenamento, GPU, temperatura, rede, uptime, top processos e ações rápidas, com dados reais atualizados periodicamente sem bloquear a UI | ✅ | `system/metrics.rs`, `services/metrics_loop.rs`, `src/features/dashboard` |
| RF-02 | CPU: utilização, núcleos lógicos, identificação, histórico recente | ✅ | `CpuMetrics`, histórico no store de métricas |
| RF-03 | Memória: total, usada, disponível, percentual, maiores consumidores | ✅ | `MemoryMetrics`, `ProcessGroup` |
| RF-04 | Armazenamento por unidade: capacidade, usado, livre, percentual (usado = total − disponível) | ✅ | `DiskMetrics` |
| RF-05 | GPU: nome, utilização, VRAM, temperatura; "Não disponível" quando o driver não expõe | ◐ | `sysinfo::Gpus` + NVML (temperatura só NVIDIA) |
| RF-06 | Rede: download/upload reais calculados por intervalo medido, histórico, conectividade | ✅ | `NetworkMetrics`, `InternetGetConnectedState` |
| RF-07 | Processos: lista com nome, PID, RAM, CPU, ordenação, busca, atualização periódica, finalizar com confirmação e proteção de processos críticos | ✅ | `system/processes.rs`, `src/features/processes` |
| RF-08 | Scanner de limpeza por categoria com quantidade, tamanho, caminhos, seleção e progresso; nunca exclui durante a análise | ✅ | `system/cleaner.rs::scan_category` |
| RF-09 | Limpeza segura: pré-visualização, seleção explícita, confirmação, progresso, cancelamento, resultado por categoria, arquivos bloqueados, espaço recuperado | ✅ | `system/cleaner.rs::clean_category`, `clean_files` |
| RF-10 | Lixeira: tamanho/itens e esvaziar com confirmação | ✅ | `system/recycle_bin.rs` |
| RF-11 | Manter tela ativa (ativar/desativar, restaurar ao sair) | ✅ | `system/power.rs` |
| RF-12 | Limpar a tela = ocultar/restaurar ícones da área de trabalho sem apagar nada | ✅ | `system/desktop.rs` |
| RF-13 | Bandeja: ícone, abrir, ocultar, estado básico, sair; fechar ≠ encerrar (configurável) | ✅ | `services/tray.rs`, `lib.rs` |
| RF-14 | Configurações persistentes: iniciar com o Windows (opt-in), iniciar minimizado, intervalo, comportamento ao fechar, interface, limpeza | ✅ | `services/settings.rs` |
| RF-15 | Instalador Windows | ✅ | NSIS por usuário (`tauri.conf.json`) |
| RF-16 | Painel compacto e janela completa | ✅ | `services/window.rs`, UI |
| RF-17 | Temperatura de CPU | ◐ | WMI `MSAcpi_ThermalZoneTemperature`; geralmente vazio sem elevação |
| RF-18 | Atualização automática | ⏳ | link para releases |

## Não funcionais

| ID | Requisito | Como é atendido |
|---|---|---|
| RNF-01 | Leve: um processo, sem serviços, sem servidor local | Tauri 2 + WebView2; thread única de métricas |
| RNF-02 | Não bloquear a UI | Coleta em thread própria; scan/limpeza em `spawn_blocking`; progresso por `Channel` |
| RNF-03 | Reduzir trabalho com janela oculta | Intervalo ≥ 5 s quando oculta/minimizada |
| RNF-04 | Segurança: menor privilégio, validação no Rust, sem scripts, sem registro além do autostart opt-in | `docs/architecture/security.md` |
| RNF-05 | Sem dados simulados na entrega | Skeletons até o primeiro snapshot; estados "Não disponível" |
| RNF-06 | Acessibilidade e teclado | Componentes com ARIA, foco visível, `reduceMotion`, DPI via unidades relativas |
| RNF-07 | Localização pt-BR (padrão) e en-US | Dicionário em `src/i18n` |
| RNF-08 | Testes automatizados sem tocar dados reais | Vitest (frontend) e `cargo test` com `tempfile` |
| RNF-09 | Build reproduzível | `pnpm-lock.yaml`, `Cargo.lock`, CI no GitHub Actions |
