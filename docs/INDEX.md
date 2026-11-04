# docs/ — Índice

> Mapa da documentação do CleanWin. A fonte da verdade detalhada está em cada arquivo; o **contrato vigente** entre interface e núcleo é [`API.md`](API.md) (reflete `src-tauri/src/commands/mod.rs`).
> Última atualização: 04/nov/2026 *(entrega v0.1.0 — docs canônicos reescritos para o CleanWin; os arquivos herdados como modelo de estrutura foram substituídos em conteúdo)*.

## Estrutura

```text
docs/
├── INDEX.md                       ← você está aqui
│   ┄ Padrão AEX (canônicos, direto em docs/) ┄
├── PRD.md                         requisitos do produto (resume e aponta project-context/)
├── ARCHITECTURE.md                arquitetura + decisões estruturais
├── API.md                         contrato IPC (comandos, eventos, canais — reflete o código real)
├── DATABASE.md                    persistência local (não há banco de dados)
├── DEPLOY.md                      build, instalador NSIS e publicação
├── ENVIRONMENT.md                 variáveis de ambiente (build) e caminhos em runtime
├── DECISIONS.md                   ADR-01..19 (registro de decisões)
├── CHANGELOG.md                   histórico por versão
├── DESIGN.md                      guia rápido de design (tokens, identidade, componentes)
├── Code-Style.md                  como o código é escrito (Rust + TypeScript)
│   ┄ detalhamento ┄
├── project-context/               visão, requisitos, design system, decisões (tabela), roadmap
├── architecture/                  visão geral, núcleo nativo, fluxo de dados, segurança (+ frontend)
├── api/                           comandos Tauri e eventos, campo a campo
├── development/                   setup, testes, build
├── qa/                            implementation-report.md (validação da entrega)
└── assets/screenshots/            capturas de tela usadas pelo README (adicionar)
```

## Por tema

### Padrão de documentação AEX (canônicos)

Camada fina e autoritativa. Raiz: [`../README.md`](../README.md) · [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) · [`../CLAUDE.md`](../CLAUDE.md) · [`../CONTRIBUTING.md`](../CONTRIBUTING.md). Nesta pasta:

- [`PRD.md`](PRD.md) — requisitos do produto (resume + aponta `project-context/`)
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — arquitetura e decisões estruturais
- [`API.md`](API.md) — contrato IPC (24 comandos, 3 eventos, 2 canais)
- [`DATABASE.md`](DATABASE.md) — persistência local: `settings.json`, logs, sessão de scan em memória
- [`DEPLOY.md`](DEPLOY.md) — `pnpm tauri build`, NSIS por usuário, GitHub Releases, assinatura pendente
- [`ENVIRONMENT.md`](ENVIRONMENT.md) — sem `.env`; variáveis de build e caminhos de runtime
- [`DECISIONS.md`](DECISIONS.md) — **os 19 ADRs** (registro canônico de decisões técnicas)
- [`CHANGELOG.md`](CHANGELOG.md) — histórico por versão (Keep a Changelog)
- [`DESIGN.md`](DESIGN.md) — o que usar e o que não fazer ao escrever tela
- [`Code-Style.md`](Code-Style.md) — convenções de Rust e TypeScript, portões de qualidade

Os canônicos resumem e linkam o detalhamento das subpastas abaixo.

### Produto

- [`project-context/overview.md`](project-context/overview.md) — visão, problemas, público, princípios, escopo e limitações
- [`project-context/product-requirements.md`](project-context/product-requirements.md) — RF-01..18 e RNF-01..09 com estado (✅ / ◐ / ⏳) e onde vivem no código
- [`project-context/design-system.md`](project-context/design-system.md) — identidade (`public/assets`), tokens, indicadores, tipografia, janela, movimento e acessibilidade
- [`project-context/decisions.md`](project-context/decisions.md) — tabela resumida das decisões (fonte dos ADRs)
- [`project-context/roadmap.md`](project-context/roadmap.md) — v0.1 → v0.2 → v0.3 e o que está fora de escopo

### Arquitetura

- [`architecture/overview.md`](architecture/overview.md) — camadas, responsabilidades, decisões-chave, layout do repo
- [`architecture/native-backend.md`](architecture/native-backend.md) — módulos Rust, estado gerenciado, coleta de métricas, processos, cleaner, shell helpers, ciclo de vida
- [`architecture/data-flow.md`](architecture/data-flow.md) — inicialização, loop de métricas, fluxo de limpeza, configurações, erros
- [`architecture/security.md`](architecture/security.md) — menor privilégio, superfície IPC, segurança da limpeza, processos, dados
- [`architecture/frontend.md`](architecture/frontend.md) — estrutura da interface (componentes, páginas, stores, regras)

### Contrato IPC

- [`api/tauri-commands.md`](api/tauri-commands.md) — cada comando: argumentos, retorno, erros
- [`api/events.md`](api/events.md) — `metrics:update`, `metrics:error`, `navigate` e os payloads dos canais de scan/limpeza

### Desenvolvimento e qualidade

- [`development/setup.md`](development/setup.md) — requisitos, primeiros passos, scripts, caminhos em runtime
- [`development/testing.md`](development/testing.md) — estratégia (Rust com `tempfile`, Vitest + jsdom), testes que dependem do Windows, regras
- [`development/build.md`](development/build.md) — build de produção, instalador, versão, assinatura, CI
- [`qa/implementation-report.md`](qa/implementation-report.md) — relatório de implementação e validação da v0.1.0 (escrito ao fim da entrega)
- [`spec/implementacao-v0.2.md`](spec/implementacao-v0.2.md) — spec de implementação das pendências (v0.2): fases, escopo, aceite, esforço e modelo por item

### Identidade visual (fora de `docs/`)

- [`../public/assets/README-ASSETS.md`](../public/assets/README-ASSETS.md) — regras do pacote de referências visuais (branding, app-icons, design-tokens, references)
- [`../public/assets/design-tokens/colors.json`](../public/assets/design-tokens/colors.json) — paleta oficial (fonte única de cor)
