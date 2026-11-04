# Contribuindo com o CleanWin

Obrigado pelo interesse. O CleanWin é um utilitário de sistema: toda contribuição precisa manter as garantias de segurança descritas em [`docs/architecture/security.md`](docs/architecture/security.md).

## Antes de abrir um PR

1. Leia [`CLAUDE.md`](CLAUDE.md) (regras fixas), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/API.md`](docs/API.md) e [`docs/Code-Style.md`](docs/Code-Style.md).
2. Abra uma issue descrevendo o problema ou a proposta (templates em `.github/ISSUE_TEMPLATE/`).
3. Crie uma branch a partir de `main`.

## Ambiente

Veja [`docs/development/setup.md`](docs/development/setup.md). Resumo: Windows x64, Node 20+, pnpm 9+, Rust ≥ 1.95 (MSVC), VS Build Tools 2022. Não há `.env` ([`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)).

## Checklist do PR

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` passam.
- [ ] `pnpm test:rust` e `cargo clippy --manifest-path src-tauri/Cargo.toml --tests -- -D warnings` passam.
- [ ] Nenhum teste toca pastas reais do usuário (use `tempfile::tempdir()` com um vizinho fora da raiz).
- [ ] Novo comando IPC: documentado em [`docs/API.md`](docs/API.md) e [`docs/api/tauri-commands.md`](docs/api/tauri-commands.md), tipado em `src/types/ipc.ts`, exposto só via `src/services/ipc.ts`.
- [ ] Nova operação destrutiva: confirmação explícita na UI **e** validação no Rust.
- [ ] Nova categoria de limpeza: raiz validada por `is_safe_root`, testes de scan/limpeza, texto na UI explicando o que será removido.
- [ ] Strings novas em `src/i18n` (pt-BR e en-US).
- [ ] Sem dependências novas sem ADR em [`docs/DECISIONS.md`](docs/DECISIONS.md); licença compatível com MIT e linha em "Créditos de terceiros" do README quando exigir atribuição.
- [ ] Sem telemetria, chamadas de rede ou escrita no Registro.
- [ ] Mudança visível ao usuário registrada em [`docs/CHANGELOG.md`](docs/CHANGELOG.md).

## Estilo

Detalhe em [`docs/Code-Style.md`](docs/Code-Style.md). Resumo:

- Rust: `cargo fmt`, Clippy limpo, erros via `AppError` (código + mensagem), nada de `unwrap()` em caminhos que dependem do sistema, `unsafe` só em `system/` com `// SAFETY:`.
- TypeScript: strict, sem `any`, componentes pequenos e acessíveis, estado em stores Zustand por domínio, cores só por token ([`docs/DESIGN.md`](docs/DESIGN.md)).
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## O que não será aceito

- "Otimizadores de RAM", encerramento automático de processos, limpeza de Registro.
- Elevação permanente, serviços, drivers, telemetria.
- Alterações na identidade visual fora de `public/assets` sem aprovação do mantenedor (ADR-18).
