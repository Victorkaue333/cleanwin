# Design system e identidade visual

Fonte única de verdade: `public/assets/` (fornecido pelo mantenedor). Nada ali é redesenhado pelo código; a interface consome os arquivos como estão.

## Identidade

| Uso | Arquivo |
|---|---|
| Cabeçalho / janela completa | `public/assets/branding/logo-horizontal.svg` (`logo-horizontal-white.svg` para fundos escuros neutros) |
| Navegação compacta, favicon, bandeja | `public/assets/branding/symbol.svg` / `symbol-white.svg` |
| Ícone do aplicativo (janela, executável, instalador) | `public/assets/app-icons/icon.ico` + `icon-16…1024.png`; gerados para `src-tauri/icons/` |
| Prancha e mockup de referência | `public/assets/references/brand-board.png`, `desktop-mockup.png` (referência, nunca usados como imagem da interface) |

Regras: não esticar, não recolorir, não recortar logotipos de capturas; o SVG horizontal usa Inter com fallback Arial.

## Tokens de cor (`public/assets/design-tokens/colors.json`)

| Token | Hex | Uso |
|---|---|---|
| `background` | `#0D1017` | fundo da janela |
| `surface` | `#171B24` | cards, barra lateral, cabeçalho |
| `primary` | `#FF7417` | ações principais (CTA "Escanear lixo"), identidade, item ativo |
| `success` | `#46E36B` | saudável, operação concluída, segmentos de uso baixo |
| `warning` | `#FFBE3D` | atenção, uso alto |
| `danger` | `#FF4545` | crítico, erro, ações destrutivas (Finalizar, Esvaziar Lixeira, Limpar) |
| `text` | `#F5F6F8` | texto principal |
| `textMuted` | `#A4A8B2` | texto secundário, rótulos |
| `border` | `#30343C` | bordas e divisores |

Os tokens são declarados uma única vez em `src/styles/globals.css` (Tailwind 4 `@theme`) e usados como utilitários (`bg-surface`, `text-primary`, …). Nenhum hex solto em componentes.

Cor nunca é o único canal: todo estado tem texto e/ou ícone (ex.: "Sistema saudável" + ponto verde; "Protegido" em processos críticos; "Em uso" em arquivos bloqueados).

## Indicadores

- **Medidor segmentado (10 células):** verde até 60 %, amarelo até 85 %, vermelho acima — a cor segue o valor, o número é sempre exibido ao lado.
- **Barra de armazenamento:** mesma escala de cores; rótulo "X GB livres de Y TB".
- **Sparklines:** SVG inline, 60 amostras, sem biblioteca de gráficos.

## Tipografia

Pilha: `Inter, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif` (sem download de fontes; o app funciona offline). Números de métricas em peso 700 e `font-variant-numeric: tabular-nums` para não "pular" a cada atualização.

## Espaçamento, raios e janela

- Escala de 4 px (Tailwind padrão); cards com raio 12–16 px e borda `border`.
- Painel compacto: 560 × 680 px lógicos (mínimo 520 × 600); janela completa: 1120 × 720 (mínimo 940 × 620). Nenhum layout pode produzir rolagem horizontal nessas dimensões.
- Título customizado (`decorations: false`) com região arrastável e controles minimizar / maximizar / fechar.

## Movimento e acessibilidade

- Transições curtas (≤ 200 ms); desativadas com `prefers-reduced-motion` ou com a preferência "Reduzir animações".
- Foco visível em todos os controles; diálogos com foco preso, `Esc` fecha, `aria-modal`.
- Contraste mínimo AA sobre `background`/`surface` (texto `#F5F6F8` e `#A4A8B2` passam; laranja usado em texto só em tamanhos ≥ 14 px bold).
- Unidades relativas (`rem`) para respeitar o escalonamento de DPI do Windows.
