# Code Style — CleanWin

Como o código deste repositório é escrito. Vale para gente e para agente de IA. Quando uma regra daqui
bate com uma configuração executável (`eslint.config.js`, `tsconfig.app.json`, Clippy, CI), **a
configuração manda** e este arquivo é que está errado.

> Última atualização: 04/nov/2026 · Mantenedor: Victor Alves
> Relacionados: [`../CLAUDE.md`](../CLAUDE.md) (regras fixas e guardrails) · [`DESIGN.md`](DESIGN.md) (UI) ·
> [`architecture/security.md`](architecture/security.md) (segurança) · [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
> (checklist de PR)

---

## 1. Regra de ouro

**Escreva como o código ao redor.** Antes de criar um arquivo, abra um vizinho do mesmo tipo (um módulo de
`system/`, um store de `src/stores/`) e siga nomes, estrutura, densidade de comentário e idioma.

Três regras que atravessam o repo inteiro:

1. **Tipos estritos nos dois lados.** TypeScript `strict` + `noUncheckedIndexedAccess`, zero `any`; Rust
   com `clippy -D warnings` e sem `unwrap()`/`expect()` em caminhos que dependem do sistema.
2. **Nenhum dado inventado.** Métrica, tamanho ou contagem vem do Rust ou é "Não disponível". Fixture só
   em teste.
3. **Zero invenção de escopo.** Código novo rastreia ao [`PRD.md`](PRD.md), ao mockup ou a um ADR. Dúvida
   vira `[PRECISA ESCLARECER: …]` no relatório, nunca uma escolha silenciosa no código.

## 2. Portões

| Comando | O que garante | Roda no CI |
|---------|---------------|:----------:|
| `pnpm typecheck` | `tsc -b --noEmit` estrito | ✅ |
| `pnpm lint` | ESLint (`@eslint/js`, `typescript-eslint`, `react-hooks`, `react-refresh`) | ✅ |
| `pnpm test` | Vitest + jsdom + Testing Library | ✅ |
| `pnpm build` | Build de produção do frontend | ✅ (via `tauri build`) |
| `pnpm test:rust` | `cargo test` (tempdir; nunca pastas reais) | ✅ |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --tests -- -D warnings` | Lint bloqueante do Rust | ✅ |
| `cargo fmt --check` | Formatação Rust | ✅ |
| `pnpm tauri build` | Executável + instalador | ✅ |

O CI (`.github/workflows/ci.yml`, `windows-latest`) roda tudo isso em todo PR.

> Falha de ambiente (toolchain, disco, SmartScreen) não se resolve mexendo no código. Separe as duas coisas
> no relato.

## 3. Rust (`src-tauri`)

### 3.1 Estrutura

```text
src-tauri/src/
  lib.rs           plugins, estado, eventos de janela, generate_handler!, cleanup
  commands/        #[tauri::command] — valida entrada, delega, spawn_blocking para I/O pesado
  services/        estado gerenciado e ciclo de vida (settings, metrics_loop, tray, window)
  system/          toda chamada nativa (metrics, processes, cleaner, recycle_bin, power, desktop)
  models/          DTOs serde (camelCase) — espelhados em src/types/ipc.ts
  errors/          AppError { code, message }
```

- Comando novo: função em `commands/mod.rs` + linha em `generate_handler!` + DTO em `models` + tipo em
  `src/types/ipc.ts` + entrada em [`API.md`](API.md) e `api/tauri-commands.md`.
- Chamada nativa nova: módulo ou função em `system/`, nunca direto no comando.

### 3.2 Regras

- **Erros:** `AppResult<T>` / `AppError` com `thiserror`; variante escolhida pelo **código** que a UI vai
  localizar (`permission_denied`, `not_found`, `protected`, `busy`, …). Mensagem técnica em inglês, curta,
  com o dado útil (pid, caminho de raiz), nunca stack trace.
- **`unsafe`:** só em `system/`, um bloco por chamada Win32, com comentário `// SAFETY:` explicando
  ponteiros e handles; handle aberto é fechado no mesmo escopo.
- **`cfg(windows)`:** função nativa tem par `#[cfg(not(windows))]` que devolve `Unsupported` — o crate
  compila (e testa a lógica pura) fora do Windows.
- **Bloqueio:** nada de I/O de disco ou shell direto num comando `async` — `tauri::async_runtime::spawn_blocking`.
  Métricas ficam na thread do `metrics_loop`.
- **Estado:** `Mutex` só para dados pequenos e rápidos; flags em `AtomicBool`/`AtomicU64`; nunca segurar um
  lock durante I/O.
- **Caminhos:** `canonicalize` antes de comparar; `starts_with` por componente; `symlink_metadata` (nunca
  `metadata`) ao percorrer; `display_path` remove o prefixo `\\?\` só para exibição.
- **Logs:** `log::{info,warn,debug}`; raízes e contagens sim, caminhos de arquivos pessoais não.
- **Versões:** verifique a API no fonte do crate pinado (`~/.cargo/registry/src/…`) antes de usar —
  `sysinfo`, `windows` e `tauri` mudam entre versões menores.
- `cargo fmt` padrão (largura 100).

### 3.3 Testes

- `#[cfg(test)] mod tests` no próprio módulo. Arquivos sempre em `tempfile::tempdir()` com raiz profunda
  (`cleanwin-tests/cache/root`) e um **vizinho fora da raiz** que precisa sobreviver.
- Testes que tocam Win32 de verdade (`power`, `recycle_bin::query`, `metrics::collector_produces_real_values`,
  arquivo bloqueado com `share_mode(0)`) ficam sob `#[cfg(all(test, windows))]`.
- Nomes descrevem a garantia: `clean_deletes_only_inside_root_and_keeps_root`.

## 4. TypeScript (`src`)

### 4.1 Estrutura

```text
src/
  app/            App.tsx — shell, modo compacto/completo, roteamento interno
  features/<x>/   domínio da tela: componentes, hooks, lógica pura, testes ao lado
  components/ui   primitivos (Button, Card, Dialog, SegmentedMeter, …)
  components/layout · shared
  stores/         Zustand, um por domínio (metrics, processes, cleaning, settings, ui, utilities, toast)
  services/ipc.ts wrappers tipados de invoke/listen/Channel — única porta para o Rust
  i18n/           pt-BR.ts (fonte) · en-US.ts · index.ts (t())
  lib/            format, thresholds, history (ring buffer), processes (sort/filter), errors, cn
  types/ipc.ts    espelho dos DTOs do Rust
  styles/         globals.css (tokens em @theme)
```

### 4.2 Regras

- `tsconfig.app.json`: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`,
  `verbatimModuleSyntax`, alias `@/*` → `src/*`. `arr[0]` é `T | undefined`: trate, não use `!`.
- **IPC só por `services/ipc.ts`.** Nenhum `invoke` cru em componente. Erro `{ code, message }` passa por
  `lib/errors.ts` para virar texto localizado.
- **Estado:** servidor → `metrics:update` → `metricsStore`; estado de fluxo em store de domínio; estado
  efêmero de componente em `useState`. Seletores finos (`useMetricsStore(s => s.snapshot?.cpu)`).
- **Componentes:** função, export nomeado, props tipadas, elemento nativo certo, nome acessível, teclado,
  `focus-visible`. Classes Tailwind com tokens (ver [`DESIGN.md`](DESIGN.md)); `cn()` para compor.
- **Strings:** toda string de UI por `t('chave')` de `src/i18n`; pt-BR é a fonte, en-US no mesmo PR.
  Vale para `aria-label`, `title`, toasts e mensagens de erro.
- **Números:** `lib/format.ts` (`formatBytes`, `formatPercent`, `formatRate`, `formatUptime`) com
  `Intl.NumberFormat('pt-BR')`; nunca `toFixed` solto.
- **Sem dependência nova** sem ADR; sem biblioteca de gráficos (ADR-17).
- Variável não usada: prefixo `_` (o lint ignora `^_`).

### 4.3 Nomes

| Coisa | Convenção | Exemplo |
|-------|-----------|---------|
| Componente / arquivo de componente | PascalCase | `SegmentedMeter.tsx` |
| Hook | `useX` em `useX.ts` | `hooks/useT.ts` |
| Store | `<domínio>Store.ts`, hook `use<Domínio>Store` | `stores/metricsStore.ts` |
| Lib / util | camelCase | `lib/format.ts` → `formatBytes` |
| Tipo IPC | mesmo nome do struct Rust | `SystemSnapshot`, `CleanSummary` |
| Chave i18n | namespace.ponto, camelCase | `dashboard.scanJunk` |
| Teste | `*.test.ts(x)` ao lado do arquivo | `lib/format.test.ts` |
| Módulo Rust | snake_case | `system/recycle_bin.rs` |
| Comando IPC | snake_case (Rust) = nome do `invoke` | `set_keep_awake` |
| Campo DTO | snake_case no Rust, camelCase no JSON/TS | `memory_bytes` ↔ `memoryBytes` |

### 4.4 Testes

- Vitest + jsdom (`tests/setup.ts` carrega `jest-dom`). `@tauri-apps/api` é mockado (`vi.mock`).
- Testar comportamento: formatação, ordenação/filtro, reducers de store, mapeamento de erro, limiares do
  `SegmentedMeter`, foco/`Esc` do `Dialog`. Sem snapshot de estilo.

## 5. Commits e PR

- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:` (escopo opcional:
  `feat(cleaner): …`). Agentes de IA **não** commitam ([`../CLAUDE.md`](../CLAUDE.md)).
- PR só com CI verde e o checklist de [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
