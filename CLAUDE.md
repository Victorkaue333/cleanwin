# CLAUDE.md — regras para agentes de IA no repositório CleanWin

> Leia **primeiro** em toda sessão. Decisões fixas e guardrails; o detalhe está nos docs linkados. Quando uma regra daqui bater com uma configuração executável (ESLint, `tsconfig`, Clippy, CI), **a configuração manda**.
> Última atualização: 04/nov/2026 · Mantenedor: Victor Alves.

## 1. O que é este repositório

CleanWin: utilitário de sistema para Windows 10/11 x64 — **Tauri 2 + Rust** (núcleo nativo em `src-tauri/`) e **React 19 + TypeScript estrito + Vite 8 + Tailwind 4** (interface em `src/`). Sem backend web, sem banco de dados, sem `.env`, sem telemetria. Contexto: [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) · requisitos: [`docs/PRD.md`](docs/PRD.md) · arquitetura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 2. Regras de git (invioláveis)

- **Não** fazer `git commit`, `git push`, criar ou trocar branch, `git reset --hard`, `git clean`, `git stash drop`. Toda alteração fica na árvore de trabalho; o mantenedor commita.
- **Não** sobrescrever arquivo existente sem antes ler o conteúdo. **Não** apagar alterações preexistentes.
- Ao terminar, relatar `git status --short` (arquivos criados/modificados).

## 3. Identidade visual (fixa)

- A única fonte é [`public/assets/`](public/assets/README-ASSETS.md): `branding/` (logos SVG), `app-icons/` (PNG + ICO), `design-tokens/colors.json` + `tokens.css`, `references/` (prancha e mockup).
- **Nunca** criar logotipo alternativo, recolorir, esticar ou recortar logos de capturas. O logo gerado por IA em sessões anteriores foi **rejeitado**.
- Cores só por token Tailwind (`bg-surface`, `text-primary`, …) declarado uma vez em `src/styles/globals.css`. Hex solto em componente é bug.
- O mockup (`references/desktop-mockup.png`) é referência de composição: reproduzir com componentes React reais, **nunca** como imagem de fundo. Guia: [`docs/DESIGN.md`](docs/DESIGN.md).

## 4. Segurança (o produto é julgado por isso)

- **Dados reais ou "Não disponível".** Nenhuma métrica, tamanho ou contagem inventada fora de fixtures de teste. Skeleton até o primeiro `metrics:update`.
- **Limpeza:** só o catálogo de `src-tauri/src/system/cleaner.rs` (`categories()`), raízes validadas por `is_safe_root`, scan nunca exclui, exclusão revalida arquivo regular + caminho canônico dentro da raiz, nunca remove a raiz, nunca segue junções/symlinks, arquivos em uso são reportados. A interface envia **ids de categoria + id de sessão**, nunca caminhos. Nova categoria = raiz segura + testes + texto na UI.
- **Processos:** confirmação na UI **e** `protection_reason` no Rust (PID 0/4, o próprio app, lista `PROTECTED_NAMES`). Nunca encerrar automaticamente. Nada de "otimização de RAM".
- **Privilégio:** nunca pedir elevação global, nunca instalar serviço/driver, nunca desativar segurança do Windows, nunca escrever no Registro além de exatamente duas escritas opt-in, por usuário (HKCU) e reversíveis: a entrada de autostart (`tauri-plugin-autostart`) e `Control Panel\NotifyIconSettings\<id>\IsPromoted` do próprio ícone da bandeja (`system/tray_icon_settings.rs`, ADR-20).
- **IPC:** comando novo = validação no Rust, erro via `AppError { code, message }`, entrada em [`docs/API.md`](docs/API.md) e tipo em `src/types/ipc.ts`. `open_external` só `http(s)`; `reveal_path` só caminhos reportados pelo app.
- Sem scripts externos, sem downloads de executáveis, sem rede (exceto o link de releases aberto no navegador pelo usuário).

## 5. Onde as coisas vivem

| O quê | Onde |
|-------|------|
| Comandos IPC (26) | `src-tauri/src/commands/mod.rs` · registrados em `src-tauri/src/lib.rs` |
| DTOs (camelCase) | `src-tauri/src/models/mod.rs` ↔ `src/types/ipc.ts` |
| Métricas (thread + evento `metrics:update`) | `src-tauri/src/system/metrics.rs` · `src-tauri/src/services/metrics_loop.rs` |
| Limpeza | `src-tauri/src/system/cleaner.rs` |
| Processos | `src-tauri/src/system/processes.rs` |
| Lixeira · energia · ícones da área de trabalho | `src-tauri/src/system/{recycle_bin,power,desktop}.rs` |
| Configurações (`settings.json`, escrita atômica) | `src-tauri/src/services/settings.rs` |
| Bandeja · janela · modos compacto/completo | `src-tauri/src/services/{tray,window}.rs` |
| Permissões da janela | `src-tauri/capabilities/default.json` |
| Janela, CSP, bundle NSIS | `src-tauri/tauri.conf.json` |
| Interface | `src/app` (shell) · `src/features/*` · `src/components/ui` · `src/stores` (Zustand) · `src/services/ipc.ts` · `src/i18n` (pt-BR fonte + en-US) · `src/lib` (format/thresholds/history) |
| Testes | Rust: `#[cfg(test)]` nos módulos (tempdir) · TS: `src/**/*.test.ts(x)` (Vitest + jsdom) |
| Docs canônicos | `docs/*.md` (ver [`docs/INDEX.md`](docs/INDEX.md)); detalhe em `docs/{project-context,architecture,api,development}/` |

## 6. Comandos

```powershell
pnpm install                 # deps + Tauri CLI
pnpm tauri dev               # app completo (Rust + Vite)
pnpm typecheck · pnpm lint · pnpm test · pnpm build        # gates do frontend
pnpm test:rust               # cargo test (tempdir; nunca toca pastas reais)
cargo clippy --manifest-path src-tauri/Cargo.toml --tests -- -D warnings
pnpm tauri build             # exe + instalador NSIS
```

Requisitos: Windows x64 · Node 20+ · pnpm 9+ · Rust ≥ 1.95 (MSVC) · VS Build Tools 2022. Detalhe em [`docs/development/setup.md`](docs/development/setup.md).

## 7. Como trabalhar

- **Verificar antes de escrever:** APIs de `sysinfo`, `windows` e `tauri` mudam entre versões; leia o fonte em `~/.cargo/registry/src/` ou a doc da versão pinada no `Cargo.lock` antes de usar um método.
- **Testes não tocam o usuário:** todo teste de arquivo usa `tempfile::tempdir()` com um "vizinho" fora da raiz para provar que sobrevive; a Lixeira só é consultada.
- **Não bloquear a UI:** trabalho pesado em thread própria ou `spawn_blocking`; progresso por `Channel`.
- **Strings:** toda string de interface em `src/i18n` (pt-BR e en-US no mesmo PR). Decimal com vírgula via `Intl.NumberFormat('pt-BR')`.
- **Acessibilidade:** foco visível, ARIA nos diálogos, `reduceMotion`/`prefers-reduced-motion`, cor nunca é o único canal de estado.
- **Documentação reflete o código:** funcionalidade não implementada não é marcada como concluída. Limitações de plataforma (sensores, GPU não NVIDIA, pastas que exigem admin) são declaradas, não escondidas.
- **Dependência nova só com justificativa** (ADR em [`docs/DECISIONS.md`](docs/DECISIONS.md)) e licença compatível com MIT (linha em "Créditos de terceiros" do README).
- Dúvida de escopo vira `[PRECISA ESCLARECER: …]` no relatório, nunca uma escolha silenciosa no código.

## 8. Relatório final de uma sessão

Resumo do que foi feito · funcionalidades concluídas / parciais / não verificadas · comandos de teste executados com resultado real · artefatos de build e caminhos · pendências e riscos · `git status --short`.

## 9. Modelos e custo (regra do mantenedor)

- **Fable só pensa; os outros implementam.** Fable (ou Mythos) fica reservado para decisões de arquitetura realmente complexas: desenho de módulos, modelo de segurança, trade-offs de IPC/concorrência, revisão final de risco. Nada de usá-lo para digitar código, docs ou rodar validação.
- **Implementação, documentação, testes, refactors, tarefas simples → modelo mais barato** (Sonnet ou Haiku; Opus só quando Sonnet falhar). Ao delegar com o Agent tool, passar `model: "sonnet"` ou `"haiku"` explicitamente; **não** usar `subagent_type: "fork"` (herda o contexto inteiro e roda no modelo caro).
- Fluxo esperado numa sessão: o modelo caro escreve o plano/brief curto → subagentes baratos executam → o caro só volta para revisar o que é arquitetural ou para decidir um impasse.
- Manter turnos enxutos: poucas chamadas de ferramenta, sem reler arquivos já conhecidos, sem relatórios intermediários longos.
