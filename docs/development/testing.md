# Testes

## Estratégia

| Camada | Ferramenta | O que cobre | Dados reais? |
|---|---|---|---|
| Rust (`src-tauri`) | `cargo test` | regras de caminho seguro, scanner, exclusão, bloqueio, cancelamento, sessões, persistência de configurações, proteção de processos, agrupamento, cálculo de porcentagem/saúde, coletor real de métricas, consulta da Lixeira | **Nunca** toca pastas do usuário: cada teste cria uma árvore em `tempfile::tempdir()`; a Lixeira é apenas consultada |
| Frontend (`src`) | Vitest + jsdom + Testing Library | formatação (bytes, %, taxas, uptime), ordenação/filtro de processos, mapeamento de erros, reducers dos stores, componentes (medidor segmentado, diálogo) | `@tauri-apps/api` é mockado |
| Integração manual | app em execução | ver `docs/qa/implementation-report.md` | sim |

## Comandos

```powershell
pnpm typecheck
pnpm lint
pnpm test                      # frontend
pnpm test:rust                 # cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --tests -- -D warnings
```

## Testes Rust que dependem do Windows

Marcados com `#[cfg(windows)]` / `#[cfg(all(test, windows))]`:

- `cleaner::tests::locked_file_is_reported_as_locked` — abre o arquivo com `share_mode(0)` para provocar `ERROR_SHARING_VIOLATION`.
- `power::tests::toggles_and_restores` — chama `SetThreadExecutionState` de verdade (sem efeito duradouro).
- `metrics::tests::collector_produces_real_values` — instancia o coletor e valida invariantes (usado + livre = total por disco, processo próprio protegido, etc.).
- `recycle_bin::tests::query_works_on_windows` — somente `SHQueryRecycleBinW`.

Em outros sistemas esses testes são ignorados pela compilação; o restante continua válido.

## Regras para novos testes

- Nenhum teste pode apagar, mover ou criar arquivos fora de um diretório temporário próprio.
- Testes de limpeza devem incluir um "vizinho" fora da raiz para provar que ele sobrevive.
- Não dependa de hardware específico (GPU, bateria): valide `Option`/status, não valores.
- Componentes: teste comportamento (texto, aria, teclado), não snapshot de estilo.
