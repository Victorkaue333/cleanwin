# CleanWin — pacote de referências visuais

## Conteúdo
- `references/brand-board.png`: prancha de identidade visual gerada para o projeto; referência estética, não recortar textos ou componentes para usar no app.
- `references/desktop-mockup.png`: mockup completo; referência de composição e hierarquia.
- `branding/`: nova proposta de logotipo vetorial, editável; **não é o logotipo antigo rejeitado**. Aprová-la antes de tratar como definitiva.
- `app-icons/`: exportações PNG/ICO do SVG proposto.
- `design-tokens/`: paleta exata em JSON e CSS.

## Regras para implementação
1. Usar `branding` e `app-icons` como arquivos, não recortar logotipos de screenshots.
2. Recriar cards, indicadores, botões, barras e textos como componentes React. Não usar mockup inteiro como interface.
3. Usar `design-tokens` como fonte única de cores. Vermelho = alerta/ação destrutiva; laranja = CTA; verde = saudável.
4. Não inventar números, métricas ou funcionalidades. Dados reais via Tauri/Rust.
5. Não alterar logos sem autorização; solicitar aprovação caso o novo conceito não seja aceito.
6. O SVG horizontal usa fonte Inter com fallback Arial; se precisar fidelidade tipográfica, instalar Inter via fonte licenciada separadamente.
7. Os arquivos PNG são derivados vetoriais. Não há necessidade de recortá-los do mockup.
