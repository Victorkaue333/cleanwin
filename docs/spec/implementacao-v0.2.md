# Spec de implementação — CleanWin v0.2 (pendências da v0.1)

> Contrato de execução das pendências registradas em [`docs/qa/implementation-report.md`](../qa/implementation-report.md) §F e no [`roadmap`](../project-context/roadmap.md). Cada item tem escopo fechado, arquivos, critérios de aceite e testes. Nada aqui foi implementado ainda.
> Modelo de execução: Fable escreve o brief, Sonnet/Haiku implementa, Fable revisa só o arquitetural ([`CLAUDE.md`](../../CLAUDE.md) §9).
> Última atualização: 04/nov/2026.

## 0. Regras gerais

- Sem commit/push pelo agente, salvo pedido explícito; commits convencionais por item (`feat(...)`, `fix(...)`, `docs(...)`).
- Nenhum dado simulado; toda métrica nova mostra "Não disponível" quando o hardware não expõe.
- Toda ação destrutiva nova: confirmação na UI **e** validação no Rust ([`docs/architecture/security.md`](../architecture/security.md)).
- Portões obrigatórios por item: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `cargo test`, `cargo clippy -D warnings`, `pnpm tauri build`.
- Esforço: S (≤ 2 h), M (½ dia), L (1–2 dias). Modelo sugerido por item.

## 1. Visão geral e ordem

| Fase | Itens | Dependência externa |
|---|---|---|
| **F1 — Higiene (sem dependências)** | P3 assets de referência fora do bundle · P9 avisos de lint · P10 ícones reais dos processos · P4 capturas pendentes · P7 checklist de autostart/bandeja | nenhuma |
| **F2 — Release** | P1 assinatura de código · P2 auto-update | certificado + par de chaves do mantenedor |
| **F3 — Funcionalidades** | P5 modo elevado por sessão + categorias que exigem admin · P6 temperatura de CPU via LibreHardwareMonitor | nenhuma (P6 depende de app de terceiros em execução) |

Ordem recomendada: P3 → P9 → P10 → P4 → P7 → P5 → P6 → P1 → P2. F2 só quando o mantenedor entregar certificado e chaves.

---

## F1 — Higiene

### P3 · Assets de referência fora do bundle — **S · Haiku**

**Problema.** `public/assets/references/*.png` (3,3 MB) entram em `dist/` e no instalador; são referência de design, não runtime.

**Escopo.**
- Mover `public/assets/references/` → `docs/assets/references/` (mesmos nomes).
- Atualizar links: `public/assets/README-ASSETS.md`, `docs/DESIGN.md`, `docs/project-context/design-system.md`, `README.md` (seção Capturas), `CLAUDE.md` §3, `docs/INDEX.md`.
- Nada no código referencia esses PNGs (confirmar com `grep -rn "references/" src`).

**Aceite.** `pnpm build` não copia os PNGs para `dist/`; instalador ≤ 1,5 MiB menor; `python` link-check dos docs sem quebrados (script usado na v0.1: varrer `](...)` relativos).

---

### P9 · Avisos `react-refresh/only-export-components` — **S · Haiku**

**Escopo.** Os 2 arquivos que exportam constantes/funções junto de componentes: mover os exports auxiliares para `src/lib/` ou arquivo irmão (`*.helpers.ts`). Sem mudança de comportamento.

**Aceite.** `pnpm lint` com 0 avisos; `pnpm test` verde.

---

### P10 · Ícones reais dos executáveis na lista de processos — **M · Sonnet**

**Problema.** O mockup mostra ícones dos apps (Firefox, Code, Discord); hoje são ícones genéricos (lucide).

**Rust (`src-tauri/src/system/process_icons.rs`, novo).**
- `SHGetFileInfoW(path, 0, &mut info, size, SHGFI_ICON | SHGFI_SMALLICON)` → `HICON` → `GetIconInfo` + `GetDIBits` (32 bpp BGRA) → PNG (crate `png` **ou** `image` com feature `png` apenas) → base64.
- Cache em memória `HashMap<PathBuf, Option<String>>` (chave = `exe`), limite 512 entradas, TTL de sessão. Processos sem `exe` (protegidos/sistema) → `None`.
- Comando `get_process_icons(paths: Vec<String>) -> HashMap<String, Option<String>>`; aceita **somente** caminhos presentes na última lista de processos (`MetricsShared.processes`), rejeita qualquer outro (`invalid_operation`).
- Features `windows`: `Win32_UI_Shell`, `Win32_UI_WindowsAndMessaging`, `Win32_Graphics_Gdi`.

**Frontend.** `processesStore` pede ícones em lote (debounce 500 ms) para os PIDs visíveis; `TopProcessesCard` e `ProcessesPage` exibem `<img src="data:image/png;base64,…">` com fallback no ícone lucide. Nunca bloquear a renderização.

**Aceite.** Lista com ícones reais para Explorer/Chrome/Code; processos protegidos mantêm o escudo; CPU do app em idle não sobe mais de 1 % com a página aberta; teste Rust que converte um `HICON` de `shell32.dll` em PNG válido (assinatura `89 50 4E 47`); teste TS do cache/debounce.

---

### P4 · Capturas de tela pendentes — **S · Haiku**

**Escopo.** `docs/assets/screenshots/full-monitoring.png`, `full-cleaning.png` (após scan), `tray.png`. Script `tools/screenshots/capture.ps1` (novo) com guarda `GetForegroundWindow() == hwnd` antes de qualquer clique e abortar se falhar. Sem caminhos pessoais na imagem (não capturar a página Processos).

**Aceite.** 3 PNGs novos, README e `docs/assets/screenshots/README.md` atualizados; script versionado e documentado em `docs/development/testing.md`.

---

### P7 · Checklist de autostart e bandeja — **S · Haiku**

**Escopo.** Documento `docs/qa/checklist-manual.md` com passos reproduzíveis: (1) ativar "Iniciar com o Windows", conferir entrada em `HKCU\…\Run` com `--minimized`, fazer logoff/logon, confirmar app só na bandeja; (2) menu da bandeja: Abrir, Ocultar, Escanear lixo (navega), Sair (processo encerra, ícones restaurados, keep-awake liberado); (3) "Iniciar minimizado" sem autostart. Registrar resultado no `implementation-report.md` quando executado.

**Aceite.** Checklist escrito; execução pelo mantenedor marca os itens.

---

## F2 — Release

### P1 · Assinatura de código — **S (config) · Sonnet** — depende de certificado

**Escopo.** `tauri.conf.json` → `bundle.windows.signCommand` com `signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a %1` (ou `certificateThumbprint`); no CI, certificado em segredo (`WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`) importado antes do `tauri build`, só em tags `v*`. Documentar em `docs/DEPLOY.md`.

**Aceite.** `signtool verify /pa cleanwin.exe` e do instalador OK; SmartScreen sem "editor desconhecido" após reputação.

---

### P2 · Auto-update — **M · Sonnet** — depende de par de chaves

**Escopo.**
- `tauri-plugin-updater` (Rust + JS), `plugins.updater.endpoints = ["https://github.com/Victorkaue333/cleanwin/releases/latest/download/latest.json"]`, `pubkey` da chave minisign gerada com `pnpm tauri signer generate` (chave privada **só** no CI como segredo `TAURI_SIGNING_PRIVATE_KEY`).
- CI: em tag `v*`, `tauri build` gera `*.exe.sig` + `latest.json`; anexar ambos à Release.
- UI: "Verificar atualizações" passa a chamar `check()`; mostra versão/notas; "Baixar e instalar" com confirmação; progresso; `relaunch()` ao final. Sem verificação automática em segundo plano por padrão (setting `checkUpdatesOnStart`, off).
- Capability: `updater:default`, `process:allow-restart`.

**Aceite.** Instalar v0.1.0 → publicar v0.2.0 de teste → app oferece e aplica a atualização; assinatura inválida é recusada (teste com `.sig` alterado).

---

## F3 — Funcionalidades

### P5 · Modo elevado por sessão + categorias que exigem admin — **L · Sonnet (revisão Fable)**

**Princípio.** Nunca elevar permanentemente. O usuário pede, por sessão, "Executar como administrador" e vê claramente o que muda.

**Rust.**
- Comando `relaunch_elevated()`: `ShellExecuteW(verb "runas", exe atual, args "--elevated")`; o processo atual encerra após o novo iniciar (single-instance precisa liberar: o novo processo passa `--elevated` e o antigo sai por `request_exit`). `AppInfo.elevated` já existe.
- Novas categorias em `cleaner.rs`, **sempre** `requires_admin: true` e **nunca** pré-selecionadas:
  - `windows_update_cache` → `%WINDIR%\SoftwareDistribution\Download` (pular se o serviço `wuauserv` estiver em execução com download ativo: checar via `QueryServiceStatusEx`? v1: avisar e pular arquivos < 24 h).
  - `delivery_optimization` → `%WINDIR%\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache`.
  - `windows_logs_setup` → `%WINDIR%\Logs\CBS\*.log` antigos (> 7 dias) e `%WINDIR%\Panther\*.log`.
- `is_safe_root`: estender a regra `windows` para permitir exatamente esses subcaminhos (lista explícita), com testes positivos e negativos.

**Frontend.** Badge "admin" já existe; adicionar banner na Limpeza: "Para limpar estas categorias, reinicie o CleanWin como administrador" com botão (confirmação explicando o que a elevação permite). Em modo elevado, mostrar selo no título.

**Aceite.** Sem elevação: categorias listadas como indisponíveis com motivo; com elevação (confirmada por UAC): scan e limpeza funcionam, relatório mostra espaço liberado; testes Rust das novas raízes; `docs/architecture/security.md` atualizado (elevação por sessão, consentimento específico).

---

### P6 · Temperatura de CPU via LibreHardwareMonitor — **M · Sonnet**

**Princípio.** Integração **opcional** e somente leitura; CleanWin não instala nem executa nada. Se o LibreHardwareMonitor (ou OpenHardwareMonitor) estiver rodando, seus sensores aparecem.

**Rust (`system/lhm.rs`, novo).**
- WMI `root\LibreHardwareMonitor` (fallback `root\OpenHardwareMonitor`): `SELECT Name, Identifier, SensorType, Value FROM Sensor WHERE SensorType='Temperature'`.
- Usar a mesma infra WMI do `sysinfo` não é possível (privada); usar crate `wmi` (**justificar no ADR**) ou COM direto via `windows` (`Win32_System_Wmi`). Preferir `windows` para não adicionar dependência.
- Refresh a cada 8 ticks, como `Components`; cache do resultado; se o namespace não existir → `status: not_available` sem log de erro repetido.
- `TemperatureMetrics.sensors` passa a incluir `source: "lhm" | "wmi_acpi"`; `cpu_c` escolhe "CPU Package"/"Core (Tctl/Tdie)".

**Frontend.** Chip "Temp." mostra o valor; tooltip indica a fonte; estado "Não disponível" ganha dica: "Instale e execute o LibreHardwareMonitor para ver temperaturas".

**Aceite.** Com LHM aberto: temperatura real no painel e na página Monitoramento; sem LHM: "Não disponível"; nenhum valor inventado; teste Rust do parser com fixture de resultado WMI.

---

## 2. Rastreabilidade

| Item | Origem | Doc a atualizar |
|---|---|---|
| P1, P2 | roadmap v0.2, relatório F.1/F.4 | DEPLOY, DECISIONS (novo ADR), CHANGELOG |
| P3 | relatório F.4 | DESIGN, README-ASSETS, INDEX |
| P4, P7 | relatório F.5/F.9 | screenshots/README, implementation-report |
| P5 | roadmap v0.2, relatório F.3 | security, PRD (RF novos), API (comandos), DECISIONS |
| P6 | relatório F.2 | native-backend, PRD RF-17, DECISIONS |
| P9, P10 | agente de frontend (diferenças vs mockup) | DESIGN §componentes |

## 3. Fora desta spec

Programas de inicialização, histórico de limpezas, alertas e ARM64 (roadmap v0.3); logo do Windows no rail (marca de terceiros — decisão mantida).
