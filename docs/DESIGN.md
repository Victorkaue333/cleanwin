# DESIGN.md — CleanWin

Guia rápido de design para quem escreve tela (gente e agente de IA). Diz **o que usar** e **o que não
fazer**. O detalhe de cada regra fica na fonte canônica:
[`project-context/design-system.md`](project-context/design-system.md) e nas regras do pacote de assets
[`../public/assets/README-ASSETS.md`](../public/assets/README-ASSETS.md).

> Última atualização: 04/nov/2026 · Mantenedor: Victor Alves
> Ordem de precedência: `public/assets/design-tokens/colors.json` → `src/styles/globals.css` (`@theme`, o que
> roda) → `project-context/design-system.md` → este arquivo.

---

## 1. Princípios

1. **A marca é acento, não superfície.** Fundo `background` e cards `surface` são grafite; o laranja
   aparece em CTA, item ativo, logo e destaque — nunca como pano de fundo.
2. **Token, nunca hex.** Nenhuma cor escrita à mão no componente. Se o token não existe, ele nasce em
   `colors.json` + `globals.css`, não no call site.
3. **Compacto primeiro.** A tela nasce no painel de 560×680 e cresce para a janela completa de 1120×720.
   Nenhum layout pode gerar rolagem horizontal nessas dimensões (mínimos 520×600 / 940×620).
4. **Dark é o único tema.** Não há tema claro na v0.1; `color-scheme: dark` no `<html>`.
5. **Dados reais ou estado honesto.** Skeleton até o primeiro snapshot; "Não disponível" / "Não suportado"
   quando o hardware não expõe. Nunca um número placeholder.
6. **Acessível por padrão.** Foco visível, contraste AA, ARIA em diálogos, `prefers-reduced-motion` e a
   preferência `reduceMotion` respeitadas; cor nunca é o único canal de estado.
7. **Mockup é referência de composição, não código.** `references/desktop-mockup.png` é reproduzido com
   componentes React; nunca entra como imagem de fundo e nada é recortado dele.

## 2. Fontes da verdade

| O quê | Onde |
|-------|------|
| Identidade (logos) | [`../public/assets/branding/`](../public/assets/branding/) — `logo-horizontal.svg`, `logo-horizontal-white.svg`, `symbol.svg`, `symbol-white.svg`, `app-icon.svg` |
| Ícones do app | [`../public/assets/app-icons/`](../public/assets/app-icons/) (`icon.ico`, `icon-16…1024.png`) → `src-tauri/icons/` |
| Paleta | [`../public/assets/design-tokens/colors.json`](../public/assets/design-tokens/colors.json) (+ `tokens.css`) |
| Tokens → classes Tailwind | `src/styles/globals.css` (`@theme`) |
| Referências visuais | `references/brand-board.png`, `references/desktop-mockup.png` |
| Limiares de cor dos indicadores | `src/lib/thresholds.ts` |
| Formatação de números | `src/lib/format.ts` (`Intl.NumberFormat('pt-BR')`) |

ADRs de UI: ADR-02 (stack), ADR-16 (dois modos de janela), ADR-17 (sparklines SVG), ADR-18 (identidade
só de `public/assets`). Tudo em [`DECISIONS.md`](DECISIONS.md).

## 3. Cor

### Paleta oficial

| Hex | Papel | Token | Classe Tailwind |
|-----|-------|-------|-----------------|
| `#0D1017` | fundo da janela | `background` | `bg-background` |
| `#171B24` | cards, barra lateral, cabeçalho | `surface` | `bg-surface` |
| `#FF7417` | ação principal, identidade, item ativo | `primary` | `bg-primary` / `text-primary` |
| `#46E36B` | saudável, concluído, uso baixo | `success` | `text-success` |
| `#FFBE3D` | atenção, uso alto | `warning` | `text-warning` |
| `#FF4545` | crítico, erro, ação destrutiva | `danger` | `bg-danger` / `text-danger` |
| `#F5F6F8` | texto principal | `text` | `text-text` |
| `#A4A8B2` | texto secundário, rótulos | `textMuted` | `text-text-muted` |
| `#30343C` | bordas e divisores | `border` | `border-border` |

- Laranja = CTA (`Escanear lixo`, `Abrir CleanWin`), item de navegação ativo, logo.
- Vermelho = só ação destrutiva (`Finalizar`, `Esvaziar Lixeira`, `Limpar`) e estado crítico/erro.
- Verde/amarelo/vermelho nos indicadores seguem `thresholds.ts`: verde até 60 %, amarelo até 85 %, vermelho acima.
- Opacidade via modificador (`bg-primary/10`, `border-danger/40`) é permitida; cor nova não.

### Estados

| Estado | Visual | Texto obrigatório |
|--------|--------|-------------------|
| Saudável | ponto `success` | "Sistema saudável" |
| Atenção | ponto `warning` | "Atenção" + motivo (`cpu_high`, `memory_high`, …) |
| Crítico | ponto `danger` | "Crítico" + motivo |
| Indisponível | texto `textMuted` | "Não disponível" / "Não suportado" |
| Protegido (processo) | botão desabilitado | "Protegido" + motivo (`kernel`, `self`, `critical_windows_process`) |
| Em uso (arquivo) | contador `warning` | "Em uso" |

## 4. Tipografia

- Pilha: `Inter, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif`. **Sem download de fonte** (o app
  é offline); Inter é usada se instalada, senão Segoe UI. O logo SVG traz Inter com fallback Arial.
- Números de métrica: peso 700 + `tabular-nums` (não "pulam" a cada atualização). Valores grandes
  (`22%`, `66%`, `81%`) em `text-3xl`; rótulos em `text-xs` `text-text-muted` uppercase opcional.
- Formatação pt-BR: `162,03 GB livres de 1 TB`, `230 kB/s`, `UP 5H 23M` — tudo por `src/lib/format.ts`;
  nunca concatenar número e unidade à mão.

## 5. Forma, sombra e motion

**Raio:** cards `rounded-2xl` (16 px); botões e chips `rounded-xl` (12 px); medidor segmentado com células
`rounded-sm`. Nunca `rounded-[Npx]`.

**Borda:** todo card tem `border border-border`; a borda, não a sombra, recorta a superfície sobre
`background`.

**Sombra:** nenhuma por padrão. Só o diálogo modal e o CTA laranja podem ter sombra discreta.

**Motion:** transições ≤ 200 ms (`transition-colors`, `transition-opacity`); barras de progresso animam
largura; nada decorativo. Sob `prefers-reduced-motion` ou `reduceMotion` (Configurações) as transições
viram instantâneas (`motion-safe:`).

## 6. Componentes

### Base (`src/components/ui`)

`Button` (variantes `primary` laranja, `secondary`, `ghost`, `danger`; tamanhos `sm`/`md`/`lg`; `loading`
bloqueia duplo clique e marca `aria-busy`), `IconButton`, `Card`, `Dialog` (foco preso, `Esc`,
`aria-modal`, confirmação para toda ação destrutiva), `SegmentedMeter` (10 células coloridas por limiar +
valor em texto), `ProgressBar`, `Spinner`, `Toaster`. Antes de criar um novo, procure aqui.

> Em implementação na mesma entrega: `Skeleton`, `EmptyState`, `ErrorState`, `Toggle`, `Tooltip`,
> `Table` e os componentes de layout (`TitleBar`, `Sidebar`/rail). Confira `src/components/` antes de
> assumir que não existem.

### Regras

- Forma de bloco; botão primário sempre laranja com texto escuro ou branco conforme contraste AA.
- Todo controle tem nome acessível (`aria-label` quando só ícone) e foco visível (`focus-visible:ring`).
- Ícone funcional é Lucide (`lucide-react`), tamanho 16/18/20; sem emoji na interface.
- Lista de processos: nome, valor (RAM/CPU) em `tabular-nums`, ação `Finalizar` em `danger` (ou
  "Protegido" desabilitado).

## 7. Layouts

| Modo | Dimensão | Estrutura |
|------|----------|-----------|
| **Compacto** (padrão) | 560×680 (mín. 520×600) | rail de ícones à esquerda (início, limpeza, monitor, configurações, sobre; alternar modo embaixo) + conteúdo: barra de título customizada, status + uptime, armazenamento, 3 cards (CPU/Memória/Disco), chips GPU/Temp/Bateria, rede, top processos, toggles (manter tela ativa / limpar a tela), CTA `Escanear lixo`, `Esvaziar Lixeira` + `Abrir CleanWin`, rodapé versão + "Verificar atualizações" |
| **Completo** | 1120×720 (mín. 940×620) | barra lateral com logo horizontal + navegação; páginas Dashboard, Monitoramento, Processos, Limpeza, Utilidades, Configurações, Sobre |

Barra de título (`decorations: false`): região arrastável (`data-tauri-drag-region`), logo/símbolo, controles
minimizar / maximizar / fechar (`getCurrentWindow()`); fechar chama `.close()` para o Rust aplicar
`closeBehavior`.

## 8. O que não fazer

- Criar, redesenhar, recolorir, esticar ou recortar logotipos. Usar o mockup como imagem.
- Hex, `rgb()` ou cor nomeada em componente. Classe `text-[#…]`.
- Número inventado, "—" silencioso ou `0` quando o dado não existe: use o estado "Não disponível".
- Cor como único sinal (ex.: segmento vermelho sem texto "Crítico").
- Diálogo nativo do sistema (`confirm`, `alert`): confirmação é o `Dialog` do app.
- Biblioteca de gráficos ou de componentes nova sem ADR.
- String de interface fora de `src/i18n`.
