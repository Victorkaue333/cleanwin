# DECISIONS — CleanWin

Registro das decisões técnicas do projeto (ADRs). Cada decisão é uma entrada **imutável**: em vez de editar uma decisão antiga, adiciona-se uma nova que a substitua — o histórico é a memória do projeto.

> Os números de ADR são **estáveis** e referenciados por outros docs (não renumerar). ADR-01..19 formalizam as decisões da entrega v0.1.0 (04/nov/2026); a tabela resumida que as originou está em [`project-context/decisions.md`](project-context/decisions.md). Este doc resume e linka — o detalhe fica nos docs-fonte de cada entrada.
> Fonte da verdade das regras fixas: [`../CLAUDE.md`](../CLAUDE.md) · Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Índice

| # | Data | Decisão | Status |
|---|------|---------|--------|
| ADR-01 | 04/nov/2026 | Tauri 2 + Rust para o núcleo nativo (não Electron) | Aceita |
| ADR-02 | 04/nov/2026 | React 19 + TypeScript estrito + Vite 8 + Tailwind 4 na interface | Aceita |
| ADR-03 | 04/nov/2026 | Zustand com um store por domínio | Aceita |
| ADR-04 | 04/nov/2026 | Loop de métricas em thread Rust com evento `metrics:update` (não polling) | Aceita |
| ADR-05 | 04/nov/2026 | `sysinfo` 0.40 como base de métricas (exige Rust ≥ 1.95) | Aceita |
| ADR-06 | 04/nov/2026 | NVML só para temperatura de GPU NVIDIA; demais fabricantes "Não disponível" | Aceita |
| ADR-07 | 04/nov/2026 | Limpeza baseada em sessão de scan (a UI envia ids, nunca caminhos) | Aceita |
| ADR-08 | 04/nov/2026 | Catálogo fixo de categorias com `is_safe_root` | Aceita |
| ADR-09 | 04/nov/2026 | Pular arquivos modificados nas últimas 24 h (configurável) | Aceita |
| ADR-10 | 04/nov/2026 | `TerminateProcess` direto com lista de processos protegidos | Aceita |
| ADR-11 | 04/nov/2026 | Thread dedicada para `SetThreadExecutionState` | Aceita |
| ADR-12 | 04/nov/2026 | Ocultar ícones da área de trabalho via `WM_COMMAND 0x7402` (sem Registro) | Aceita |
| ADR-13 | 04/nov/2026 | Configurações em JSON com escrita atômica (sem banco de dados) | Aceita |
| ADR-14 | 04/nov/2026 | Autostart pelo plugin oficial com `--minimized`, opt-in | Aceita |
| ADR-15 | 04/nov/2026 | Instalador NSIS por usuário (sem UAC, sem WiX) | Aceita |
| ADR-16 | 04/nov/2026 | Dois modos de janela (compacto/completo) na mesma janela nativa | Aceita |
| ADR-17 | 04/nov/2026 | Sem biblioteca de gráficos (sparklines em SVG) | Aceita |
| ADR-18 | 04/nov/2026 | Identidade visual exclusivamente de `public/assets` | Aceita (decisão do mantenedor) |
| ADR-19 | 04/nov/2026 | Sem auto-update na v0.1; "Verificar atualizações" abre a página de releases | Aceita |
| ADR-20 | 04/nov/2026 | Preferência de ícone na bandeja via NotifyIconSettings (HKCU, opt-in, reversível) | Aceita |

---

## ADR-01 — Tauri 2 + Rust para o núcleo nativo (não Electron)

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

O produto exige APIs nativas do Windows (processos, Shell, energia, DXGI/PDH), binário leve e um modelo de permissões auditável. O briefing veta Electron, Next.js, NestJS e bancos de dados.

### Decisão

Tauri 2 com núcleo em Rust (`src-tauri`), WebView2 para a interface e **capabilities** restringindo o que a janela `main` pode invocar. Toda chamada ao sistema vive em `system/`; a interface nunca toca o SO.

### Alternativas consideradas

- Electron — vetado pelo produto; binário e consumo de memória incompatíveis com "leve".
- .NET/WinUI — stack nativa, mas perderia o front React/TS e o ecossistema de componentes.

### Consequências

Rust ≥ 1.95 e VS Build Tools no ambiente de dev; compilação inicial de minutos; em troca, acesso direto a Win32 pelo crate `windows` e superfície IPC explícita (24 comandos).

Fonte: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`architecture/overview.md`](architecture/overview.md).

## ADR-02 — React 19 + TypeScript estrito + Vite 8 + Tailwind 4 na interface

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

Duas apresentações (painel compacto e janela completa) com os mesmos componentes; tokens de cor fixos pelo mantenedor; necessidade de testes de componente.

### Decisão

React 19 com `strict`, `noUncheckedIndexedAccess`; Vite 8 (alvo `es2022`, WebView2 é Chromium); Tailwind 4 com os tokens de `public/assets/design-tokens/colors.json` declarados uma vez em `@theme`; lucide-react para ícones; Vitest + jsdom.

### Alternativas consideradas

- Vue/Svelte — sem vantagem decisiva; o time e o mockup já assumem React.
- CSS Modules — perderia a centralização de tokens que o design system exige.

### Consequências

Nenhum hex em componente; `pnpm typecheck` + `lint` + `test` + `build` como portões. `@vitejs/plugin-react` 6 e `@tailwindcss/vite` 4 declaram suporte a Vite 8.

## ADR-03 — Zustand com um store por domínio

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

Estado compartilhado entre páginas (snapshot de métricas + histórico, lista de processos, sessão de limpeza, configurações, UI) sem boilerplate.

### Decisão

Stores Zustand separados: `metricsStore` (snapshot + ring buffers), `processesStore`, `cleaningStore`, `settingsStore` (espelho de `settings.json` com atualização otimista e rollback), `uiStore` (modo, página, diálogos), `utilitiesStore`, `toastStore`.

### Alternativas consideradas

- Redux Toolkit — excesso de cerimônia para o tamanho do app.
- Context apenas — re-renderizações amplas a cada snapshot (1–2 s).

### Consequências

Seletores finos por componente; testes de reducers sem DOM.

## ADR-04 — Loop de métricas em thread Rust com evento `metrics:update` (não polling)

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

CPU em `sysinfo` é um delta entre dois refreshes do **mesmo** `System`; polling por `invoke` com um `System` novo por chamada devolveria 0 %. A bandeja precisa de números mesmo com a janela oculta.

### Decisão

Uma thread (`services/metrics_loop.rs`) detém o `MetricsCollector`, refresca no intervalo configurado (500–10 000 ms), guarda o snapshot em `MetricsShared`, atualiza a bandeja e emite `metrics:update`. Com a janela oculta/minimizada o intervalo sobe para ≥ 5 s em vez de parar. `request_metrics_refresh` acorda a thread.

### Alternativas consideradas

- Polling pela interface — múltiplas fontes, CPU incorreta, trabalho duplicado.
- Parar com janela oculta — bandeja desatualizada.

### Consequências

A interface só escuta; `get_system_snapshot` existe para o primeiro paint e para depuração.

## ADR-05 — `sysinfo` 0.40 como base de métricas (exige Rust ≥ 1.95)

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

Precisamos de CPU, RAM, discos, rede, processos, GPU e sensores. `sysinfo` 0.40 já implementa GPU no Windows (DXGI + PDH `GPU Engine`) e sensores via WMI.

### Decisão

`sysinfo = "0.40"` com features padrão; `windows` 0.62 alinhado à mesma versão que o `sysinfo` usa (uma compilação só do crate). `rust-version = "1.95"` no `Cargo.toml`; o toolchain do ambiente de dev foi atualizado para 1.99.1.

### Alternativas consideradas

- Implementar DXGI/PDH/WMI à mão — mais código `unsafe` para o mesmo resultado.
- `sysinfo` ≤ 0.38 — sem GPU e mesmo assim MSRV 1.95.

### Consequências

Contribuidores precisam de Rust ≥ 1.95 (documentado em [`ENVIRONMENT.md`](ENVIRONMENT.md)).

## ADR-06 — NVML só para temperatura de GPU NVIDIA

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

Não existe API oficial e vendor-neutra de temperatura de GPU no Windows sem driver kit. O produto proíbe inventar métricas.

### Decisão

`nvml-wrapper` carregado em runtime (`Nvml::init().ok()`): se houver driver NVIDIA, `temperatureC` + `temperatureSource: "nvml"` na GPU correspondente; caso contrário `null` e a interface mostra "Não disponível". Utilização e VRAM vêm do `sysinfo` para qualquer fabricante.

### Alternativas consideradas

- ADL (AMD) / IGCL (Intel) — SDKs com distribuição e licenças que não cabem na v0.1.

### Consequências

Dependência opcional em runtime (sem NVIDIA, o `init` falha silenciosamente).

## ADR-07 — Limpeza baseada em sessão de scan

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

Se a interface enviasse caminhos para excluir, um bug ou injeção na UI poderia apagar qualquer arquivo. É a classe de risco mais grave do produto.

### Decisão

`scan_cleanup` produz uma `ScanSession` guardada em `CleanerState` (TTL 30 min, uso único) e devolve apenas um `sessionId` + resumos. `clean_files` recebe `sessionId` + ids de categoria e apaga **só** o que a sessão listou, revalidando cada arquivo (regular, sem reparse point, caminho canônico `starts_with` da raiz canônica).

### Alternativas consideradas

- UI envia lista de caminhos — rejeitada pelo risco acima.
- Sessão em disco — desnecessário; expirar em memória é mais seguro.

### Consequências

Segunda limpeza exige novo scan; `busy` impede concorrência.

## ADR-08 — Catálogo fixo de categorias com `is_safe_root`

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

"Não excluir arquivos pessoais, diretórios arbitrários ou dados de aplicações sem consentimento específico."

### Decisão

`cleaner::categories()` resolve raízes a partir das variáveis do perfil (`user_temp`, `windows_temp`, `browser_cache`, `crash_reports`, `shader_cache`, `thumbnail_cache`, `inet_cache`). `is_safe_root` rejeita raiz de unidade, `Users`, perfil, `AppData`/`Local`/`Roaming`, pastas pessoais, `Windows` (exceto `Temp`), `System32`, `Program Files`, `ProgramData` raso. Junções e symlinks não são seguidos.

### Alternativas consideradas

- Pastas configuráveis pelo usuário — entra só com seleção explícita por arquivo (B4), nunca como raiz de varredura.

### Consequências

Nova categoria = raiz + testes de scan/limpeza + texto na UI (checklist em [`../CONTRIBUTING.md`](../CONTRIBUTING.md)).

## ADR-09 — Pular arquivos modificados nas últimas 24 h (configurável)

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

Temporários recém-criados costumam pertencer a instaladores e apps abertos.

### Decisão

`CleaningSettings { skipRecentFiles: true, recentHours: 24 }` aplicado nas categorias de temp/cache (`skip_recent_applies`); relatórios de erro e thumbcache não usam a regra. Arquivos pulados são contados (`skippedRecentCount/Bytes`) e exibidos.

### Consequências

Menos "arquivo em uso"; o usuário pode desligar a regra nas Configurações.

## ADR-10 — `TerminateProcess` direto com lista de processos protegidos

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

`sysinfo::Process::kill()` devolve só `bool`; o usuário precisa saber **por que** falhou (elevado? já encerrado?).

### Decisão

`processes::terminate` recusa antes de abrir handle quando `protection_reason` (PID 0/4, o próprio app, `PROTECTED_NAMES`) existe; depois `OpenProcess(PROCESS_TERMINATE)` + `TerminateProcess`, mapeando `ERROR_ACCESS_DENIED` → `permission_denied` e `ERROR_INVALID_PARAMETER` → `not_found`. Nunca encerra automaticamente.

### Consequências

Mensagens honestas na UI; sem "otimização de RAM".

## ADR-11 — Thread dedicada para `SetThreadExecutionState`

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

O estado de execução é **por thread**; comandos Tauri rodam em pool.

### Decisão

`system::power::KeepAwake` cria uma thread que recebe enable/disable por canal, chama `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED)` e confirma pelo retorno; `shutdown` e `Drop` sempre limpam; `window::cleanup` chama em `ExitRequested`.

## ADR-12 — Ocultar ícones da área de trabalho via `WM_COMMAND 0x7402`

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

"Limpar a tela" = organização visual, sem apagar nada e sem Registro.

### Decisão

Localizar `SHELLDLL_DefView` (sob `Progman` ou `WorkerW`), ler `IsWindowVisible` do `SysListView32`, enviar `WM_COMMAND 0x7402` (o mesmo item "Mostrar ícones da área de trabalho" do Explorer) e reler o estado para confirmar. Se o CleanWin ocultou, restaura ao sair.

### Alternativas consideradas

- `HKCU\…\Advanced\HideIcons` + reiniciar o Explorer — Registro e disruptivo.

## ADR-13 — Configurações em JSON com escrita atômica (sem banco de dados)

- **Data:** 04/nov/2026 · **Status:** Aceita

### Decisão

`settings.json` em `app_config_dir`, `#[serde(default)]`, `sanitized()` na leitura e escrita, `write_atomic` (temp + rename). Arquivo inválido vira `.invalid` e o app usa defaults. Detalhe em [`DATABASE.md`](DATABASE.md).

### Alternativas consideradas

- `tauri-plugin-store`, SQLite — dependência extra sem necessidade.

## ADR-14 — Autostart pelo plugin oficial com `--minimized`, opt-in

- **Data:** 04/nov/2026 · **Status:** Aceita

### Decisão

`tauri-plugin-autostart` cria `HKCU\…\Run\CleanWin` com `--minimized` **só** quando o usuário liga a opção; `update_settings` aplica/remove e faz rollback do flag se o plugin falhar; `get_autostart_enabled` lê o estado real. É a única escrita de Registro do app.

## ADR-15 — Instalador NSIS por usuário (sem UAC, sem WiX)

- **Data:** 04/nov/2026 · **Status:** Aceita

### Decisão

`bundle.targets = ["nsis"]`, `installMode = "currentUser"`, idiomas pt-BR/en, WebView2 bootstrapper silencioso. MSI/WiX exigiria download extra e instalação por máquina.

## ADR-16 — Dois modos de janela na mesma janela nativa

- **Data:** 04/nov/2026 · **Status:** Aceita

### Decisão

`viewMode` (`compact` 560×680 / `full` 1120×720) é uma configuração; `window::apply_view_mode` redimensiona a janela `main` e a interface troca o layout. Uma só assinatura de eventos, um só estado.

## ADR-17 — Sem biblioteca de gráficos (sparklines em SVG)

- **Data:** 04/nov/2026 · **Status:** Aceita

### Decisão

Histórico (CPU, rede) em ring buffers no `metricsStore` desenhado como `<svg>` inline. Peso zero, controle total do custo de render a cada 1–2 s. Gatilho para reconsiderar: mais de duas séries simultâneas ou interação (zoom/brush).

## ADR-18 — Identidade visual exclusivamente de `public/assets`

- **Data:** 04/nov/2026 · **Status:** Aceita (decisão do mantenedor)

### Contexto

Um logotipo gerado por IA durante a implementação foi **rejeitado**; o mantenedor entregou o pacote oficial (`branding/`, `app-icons/`, `design-tokens/`, `references/`).

### Decisão

Logos, ícones e cores vêm só de `public/assets`; o mockup é reproduzido com componentes React, nunca como imagem de fundo; nenhum hex fora de `globals.css`. Guia em [`DESIGN.md`](DESIGN.md).

## ADR-19 — Sem auto-update na v0.1

- **Data:** 04/nov/2026 · **Status:** Aceita

### Decisão

"Verificar atualizações" abre a página de releases no navegador via `open_external`. `tauri-plugin-updater` entra com assinatura de código e releases assinadas (B1/B2), evitando um endpoint e uma chave que ainda não existem.

## ADR-20 — Preferência de ícone na bandeja via NotifyIconSettings (HKCU, opt-in, reversível)

- **Data:** 04/nov/2026 · **Status:** Aceita

### Contexto

O Windows 11 esconde ícones novos no menu "^" da bandeja. Para um utilitário de monitoramento isso torna o ícone (e as métricas de CPU/RAM no tooltip) praticamente invisível. O Windows guarda a preferência por usuário em `HKCU\Control Panel\NotifyIconSettings\<id>` (`ExecutablePath`, `InitialTooltip`, `IsPromoted`); `IsPromoted=1` fixa o ícone na barra. A chave é criada pelo Explorer na primeira vez que o ícone aparece.

### Decisão

Opção **opt-in** ("Ícone sempre visível na bandeja", com diálogo de primeira execução e interruptor em Configurações). `system/tray_icon_settings.rs` localiza a subchave cujo `ExecutablePath` é o próprio executável (comparação canônica, sem diferenciar maiúsculas) e grava `IsPromoted=1`; desligar remove o valor. Comandos `get_tray_icon_promoted` / `set_tray_icon_promoted`; a escolha fica em `settings.json` (`trayIconPromoted`) e é reaplicada na partida (tentativas a cada 500 ms por até 15 s, pois o Explorer pode demorar a registrar o ícone). É, junto com a entrada de autostart, **uma das duas únicas escritas no Registro** do app — ambas por usuário, opt-in e reversíveis.

### Alternativas

- **Não fazer nada / só documentar:** o usuário teria de arrastar o ícone manualmente; rejeitado pela má descoberta.
- **Promover sem perguntar:** viola o princípio de não alterar o sistema sem consentimento.
- **API de shell (`ITrayNotify`, COM não documentada):** instável entre builds do Windows.

### Consequências

Depende de um comportamento não documentado do Windows 10/11 (a chave pode mudar); falha de forma segura (`not_found`/`unsupported`, a UI informa e a opção segue disponível em Configurações). Reinstalações mantêm a preferência porque o caminho do exe é estável. A superfície IPC passa a 26 comandos.
