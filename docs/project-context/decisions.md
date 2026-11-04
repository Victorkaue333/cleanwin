# Decisões arquiteturais (ADR resumido)

| # | Decisão | Alternativas | Motivo |
|---|---|---|---|
| 1 | **Tauri 2 + Rust** para o núcleo nativo | Electron, .NET/WinUI | Binário pequeno, WebView2 já presente no Windows 10/11, acesso direto a Win32 pelo crate `windows`, modelo de permissões por capability. Electron foi vetado pelo produto. |
| 2 | **React 19 + TypeScript strict + Vite 8 + Tailwind 4** | Vue, Svelte | Ecossistema do time, componentes reutilizáveis, Tailwind com tokens centralizados via `@theme`. |
| 3 | **Zustand** para estado compartilhado | Redux, Context | Stores pequenos por domínio (métricas, processos, limpeza, configurações, UI) sem boilerplate. |
| 4 | **Loop de métricas em thread Rust com evento `metrics:update`** | Polling `invoke` pela UI | Uma única fonte de amostragem, CPU calculada corretamente (delta entre refreshes do mesmo `System`), bandeja atualizada mesmo com janela oculta, intervalo adaptativo. |
| 5 | **`sysinfo` 0.40** como base de métricas (CPU, RAM, discos, rede, processos, GPU via DXGI/PDH, sensores via WMI) | WMI manual, PDH manual | API madura, multiplataforma, já implementa DXGI/PDH para GPU no Windows. Exige Rust ≥ 1.95. |
| 6 | **NVML só para temperatura de GPU NVIDIA** | Vendor SDKs (ADL, IGCL) | Único SDK estável acessível sem driver kit; outros fabricantes ficam "Não disponível" em vez de inventar valor. |
| 7 | **Limpeza baseada em sessão de scan** (lista de arquivos fica no Rust; UI envia só ids) | UI envia caminhos | Elimina a classe de bug "caminho arbitrário vindo da UI"; a exclusão revalida cada arquivo contra a raiz canônica. |
| 8 | **Catálogo fixo de categorias** com `is_safe_root` | Pastas configuráveis pelo usuário | Pastas arbitrárias contradizem "não excluir dados pessoais"; o catálogo é auditável e testado. |
| 9 | **Pular arquivos modificados nas últimas 24 h** (configurável) | Excluir tudo | Temporários recentes costumam estar em uso; evita quebrar instaladores/apps abertos. |
| 10 | **`TerminateProcess` direto com lista de processos protegidos** | `sysinfo::Process::kill` | `kill()` só devolve `bool`; com Win32 o erro real (acesso negado, PID inexistente) chega ao usuário. |
| 11 | **Thread dedicada para `SetThreadExecutionState`** | Chamar no comando | O estado é por thread; comandos rodam em pool. |
| 12 | **Ocultar ícones via `WM_COMMAND 0x7402`** | Registro `HideIcons` + restart do Explorer | Mesmo mecanismo do menu do Explorer, sem tocar no Registro, reversível e verificável. |
| 13 | **Settings em JSON com escrita atômica** no `app_config_dir` | plugin-store, SQLite | Sem dependência extra, legível, `#[serde(default)]` tolera versões antigas; nenhum banco de dados é necessário. |
| 14 | **Autostart pelo plugin oficial** com `--minimized` | Tarefa agendada, pasta Startup | Única escrita de Registro do app, opt-in explícito, removida ao desativar. |
| 15 | **Instalador NSIS por usuário** | MSI/WiX, instalação por máquina | Sem UAC, coerente com menor privilégio; WiX exigiria download extra na build. |
| 16 | **Dois modos de janela (compacto/completo)** na mesma janela nativa | Duas janelas | Estado e assinaturas únicos; o Rust só redimensiona. |
| 17 | **Sem gráfico de terceiros** (sparklines em SVG) | Recharts, Chart.js | Peso zero, controle de performance em 1–2 s de intervalo. |
| 18 | **Identidade visual exclusivamente de `public/assets`** | Logo gerado pela IA (rejeitado) | Decisão do mantenedor em 2026-11-04. |
| 19 | **Sem auto-update nesta versão** | tauri-plugin-updater | Exigiria chave de assinatura e endpoint; "Verificar atualizações" abre a página de releases. |
