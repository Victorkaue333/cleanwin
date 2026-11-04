# Frontend (React + TypeScript)

Interface renderizada pelo WebView2 dentro da janela Tauri. Nenhuma lógica de sistema vive aqui: a UI formata, navega, confirma e exibe o que o Rust entrega por IPC (`docs/api/tauri-commands.md`, `docs/api/events.md`).

## Estrutura (`src/`)

```
src/
├── main.tsx · app/App.tsx            bootstrap: listeners de eventos, carga de settings, frontend_ready
├── components/
│   ├── ui/                            Button · IconButton · Card · Badge · Checkbox · Select · Toggle (role=switch)
│   │                                  SegmentedMeter (10 células + rótulo) · ProgressBar · Sparkline (SVG inline)
│   │                                  Dialog (focus trap, Esc, aria-modal) · Toaster · Tooltip · Skeleton
│   │                                  EmptyState · ErrorState · Spinner  (+ testes Dialog/SegmentedMeter)
│   ├── layout/                        TitleBar (drag region + min/max/close) · NavRail (rail compacto / sidebar completa) · AppShell
│   └── shared/                        BrandLogo · HealthRow · StorageCard · MetricCard · StatChip · NetworkCard
│                                      TopProcessesCard · QuickActions
├── features/
│   ├── dashboard/DashboardPage.tsx    painel (compacto = mockup; completo = 2 colunas + histórico)
│   ├── monitoring/MonitoringPage.tsx  CPU por núcleo + sparkline, memória, unidades, GPU/sensores, rede
│   ├── processes/ProcessesPage.tsx    tabela ordenável, busca, finalizar com confirmação, protegidos desabilitados
│   ├── cleaning/CleaningPage.tsx      categorias, scan com progresso (Channel), prévia, seleção, limpeza, cancelamento, resultado
│   ├── utilities/UtilitiesPage.tsx    manter tela ativa, ícones da área de trabalho, Lixeira
│   └── settings/                      SettingsPage (todos os campos de Settings, autostart opt-in) · AboutPage
├── stores/                            Zustand: settings · metrics (histórico 60 pontos) · ui · cleaning · processes · utilities · toast
├── services/ipc.ts                    único ponto de `invoke`/`listen`/`Channel`; tipado por types/ipc.ts
├── types/ipc.ts                       espelho TypeScript de src-tauri/src/models (camelCase)
├── i18n/                              pt-BR (padrão) e en-US; `Intl.NumberFormat` para unidades e porcentagens
├── lib/                               formatação (bytes, taxas, uptime), ordenação/filtro, mapeamento de erros (+ testes)
├── hooks/                             assinatura de eventos, atalhos, reduced-motion
└── styles/globals.css                 importa public/assets/design-tokens/tokens.css e expõe os tokens ao Tailwind (@theme)
```

## Regras

- **Sem dados simulados:** skeletons até o primeiro `metrics:update`; estados vazio/erro em cada painel; GPU/temperatura/bateria ausentes mostram "Não disponível"/"Não suportado".
- **IPC só por `services/ipc.ts`**; erros `{ code, message }` passam por `lib` para texto localizado.
- **Confirmação explícita** (Dialog) antes de finalizar processo, limpar arquivos e esvaziar a Lixeira.
- **Cores só por token** (`bg-surface`, `text-primary`, …); nenhum hex em componente. Logos e ícones vêm de `public/assets/`.
- **Dois modos** na mesma árvore: `uiStore.viewMode` (`compact` 560×680 / `full` 1120×720) espelha `Settings.viewMode`; trocar chama `set_view_mode` e o Rust redimensiona a janela.
- **Acessibilidade:** foco visível, navegação por teclado, `aria-*` nos controles, `prefers-reduced-motion` e preferência "Reduzir animações".

## Testes (Vitest + jsdom)

9 arquivos / 51 testes: formatação, ordenação e filtro de processos, mapeamento de erros, reducers do `cleaningStore`, `settingsStore` com IPC mockado, paridade de chaves i18n pt/en, `SegmentedMeter` (limiares) e `Dialog` (foco/Esc). `tests/setup.ts` mocka `@tauri-apps/api`.
