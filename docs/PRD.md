# PRD — CleanWin

> **Documento de Requisitos do Produto.** Camada de produto — fina e navegável: descreve o **quê** e delega o **como** à arquitetura e ao código.
> Entrega: **v0.1.0 — 04/nov/2026** · Mantenedor: Victor Alves.
> **Precedência:** havendo divergência entre este PRD e o código (`src-tauri/src/**`, `src/**`), **o código prevalece** e este documento é corrigido. A tabela completa de requisitos com estado e localização no código está em [`project-context/product-requirements.md`](project-context/product-requirements.md).

## Visão

**CleanWin** é um utilitário de sistema open source para Windows 10 e 11 que centraliza monitoramento em tempo real, gerenciamento seguro de processos, limpeza de arquivos temporários com pré-visualização e utilidades de manutenção em uma única janela leve. Não é antivírus, não é "otimizador de RAM", não mexe no Registro — **é a camada de visibilidade e ação segura que faltava ao usuário comum**.

Slogan: *Seu Windows, sob controle.* Visão de negócio em [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md).

## Personas

| Persona | Necessidade | Contexto de uso |
|---------|-------------|-----------------|
| **Usuário doméstico** (~60 %) | Saber por que o PC está lento e liberar espaço sem risco | Painel compacto, botão "Escanear lixo", confirmações claras |
| **Usuário avançado / dev** (~30 %) | Métricas sempre à mão, processo pesado identificado em segundos | Bandeja + painel compacto aberto ao lado do trabalho; janela completa para detalhe |
| **Técnico de suporte** (~10 %) | Limpeza previsível e auditável, sem elevação permanente | Relatório por categoria (apagados / em uso / falhas), logs locais |

### Atores e acesso

Não há contas, login nem perfis. O aplicativo roda **como o usuário atual** e tudo o que exigiria administrador é tratado como **parcial e declarado** (ex.: `C:\Windows\Temp`). Operações destrutivas exigem confirmação explícita na interface e são validadas novamente no Rust.

## Requisitos funcionais

Resumo por módulo (IDs RF-*). Prioridade: **Deve** = obrigatório na v0.1; **Deveria** = parcial por limitação de plataforma; **Roadmap** = fora da v0.1. Detalhe, estado e localização por RF em [`project-context/product-requirements.md`](project-context/product-requirements.md).

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-01 | Dashboard com estado geral, CPU, RAM, armazenamento, GPU, temperatura, rede, uptime, top processos e ações rápidas — dados reais, atualização periódica sem bloquear a interface, menos trabalho com a janela oculta | Deve |
| RF-02..04 | CPU (uso, núcleos lógicos, identificação, histórico) · Memória (total/usada/disponível/%, maiores consumidores) · Armazenamento por unidade (total, usado = total − disponível, livre, %) | Deve |
| RF-05 | GPU: nome, utilização, VRAM, temperatura — "Não disponível"/"Não suportado" quando o driver não expõe | Deveria *(temperatura só NVIDIA)* |
| RF-06 | Rede: download/upload medidos por intervalo real, histórico, conectividade | Deve |
| RF-07 | Processos: lista (nome, PID, RAM, CPU), ordenação, busca, atualização periódica, finalizar com confirmação, proteção de processos críticos, tratamento de permissão/processo encerrado | Deve |
| RF-08 | Scanner de limpeza por categoria: quantidade, tamanho estimado, caminhos, seleção, progresso; **nunca exclui durante a análise** | Deve |
| RF-09 | Limpeza segura: pré-visualização, seleção explícita, confirmação, progresso, cancelamento, resultado por categoria, arquivos bloqueados, espaço recuperado; validação de caminhos no Rust | Deve |
| RF-10 | Lixeira: itens/tamanho e esvaziar com confirmação | Deve |
| RF-11 | Manter tela ativa (ativar/desativar; restaurar ao sair) | Deve |
| RF-12 | "Limpar a tela": ocultar/restaurar ícones da área de trabalho sem apagar nada | Deve |
| RF-13 | Bandeja: ícone, abrir, ocultar, estado básico (CPU/RAM), escanear, sair; fechar ≠ encerrar (configurável); opção opt-in "ícone sempre visível na bandeja" (ADR-20) e diálogo de primeira execução | Deve |
| RF-14 | Configurações persistentes: iniciar com o Windows (opt-in), iniciar minimizado, intervalo, comportamento ao fechar, modo de janela, idioma, métricas na bandeja, reduzir animações, preferências de limpeza | Deve |
| RF-15 | Instalador para Windows (NSIS, por usuário) | Deve |
| RF-16 | Duas apresentações: painel compacto (560×680) e janela completa (1120×720) | Deve |
| RF-17 | Temperatura de CPU | Deveria *(WMI; vazio sem elevação)* |
| RF-18 | Atualização automática | Roadmap |

## Requisitos não-funcionais

- **RNF-01 · Leveza** — um processo, sem serviços, sem servidor local, sem banco de dados.
- **RNF-02 · Não bloquear a UI** — coleta em thread própria; scan/limpeza em `spawn_blocking` com progresso por `Channel`.
- **RNF-03 · Economia com janela oculta** — intervalo ≥ 5 s quando oculta/minimizada (a bandeja continua atualizando).
- **RNF-04 · Segurança** — menor privilégio; validação no Rust; sem scripts, downloads ou Registro além do autostart opt-in; ações destrutivas confirmadas. Detalhe em [`architecture/security.md`](architecture/security.md).
- **RNF-05 · Sem dados simulados** — skeletons até o primeiro snapshot; estados "Não disponível".
- **RNF-06 · Acessibilidade** — ARIA, foco visível, teclado, `reduceMotion`, DPI por unidades relativas, cor nunca como único canal.
- **RNF-07 · Localização** — pt-BR (fonte) e en-US; formatação `Intl` pt-BR.
- **RNF-08 · Testes** — Rust (`tempfile`, nunca pastas reais) e Vitest (jsdom); CI em `windows-latest`.
- **RNF-09 · Build reproduzível** — `pnpm-lock.yaml`, `Cargo.lock`, instalador gerado pelo CI.

**Restrições (CON-01..06):** Windows 10/11 x64 apenas · Tauri 2 + Rust + React/TS (sem Electron/Next/Nest/bancos) · identidade visual exclusivamente de `public/assets` · zero dados simulados na entrega · zero serviços externos (só o link de releases) · **nenhuma ação destrutiva sem confirmação e validação no Rust**.

## Fluxos principais

### Primeiro uso (< 30 s até a primeira métrica)

1. Instalador por usuário (sem UAC) → atalho no menu Iniciar.
2. Abre o painel compacto; skeletons até o primeiro `metrics:update` (≤ 2 s).
3. Estado "Sistema saudável / Atenção / Crítico" com motivo; cards de CPU, RAM, disco; rede; top processos.

### Loop de limpeza

1. "Escanear lixo" → scan das categorias padrão (sem excluir) com progresso por categoria.
2. Resultado: quantidade, tamanho, maiores arquivos, avisos (parcial sem admin, feche o navegador).
3. Usuário seleciona categorias e confirma.
4. Limpeza com progresso; cancelável; relatório: apagados, em uso, falhas, pastas vazias removidas, espaço recuperado.

### Loop de processos

1. Lista agrupada por nome no dashboard; lista completa com PID na janela completa.
2. Busca/ordenação; "Finalizar" só em processos não protegidos.
3. Confirmação → `kill_process` → erro real (`permission_denied`, `not_found`) ou sucesso.

### Bandeja

1. Fechar a janela → oculta na bandeja (padrão) ou sai (configurável).
2. Menu: status CPU/RAM · Abrir · Ocultar · Escanear lixo · Sair. Clique esquerdo alterna a janela.
3. Ao sair: libera "manter tela ativa" e restaura ícones da área de trabalho se o app os ocultou.

## Critérios de aceite

Definition of Done da v0.1. O estado de cada item (verificado / parcial / não verificado) é registrado em [`qa/implementation-report.md`](qa/implementation-report.md) ao fim da validação — este PRD lista o critério, não o resultado:

- [ ] A aplicação inicia no Windows e o dashboard mostra métricas reais.
- [ ] Monitoramento atualiza no intervalo configurado e desacelera com a janela oculta.
- [ ] Lista de processos funciona; finalizar exige confirmação e respeita a lista de protegidos.
- [ ] Scanner lista categorias com tamanho sem excluir nada.
- [ ] Limpeza exige confirmação, revalida caminhos e reporta arquivos em uso.
- [ ] Lixeira, manter tela ativa e ícones da área de trabalho funcionam e são restaurados ao sair.
- [ ] Bandeja funciona (abrir/ocultar/sair; status).
- [ ] Configurações persistem em `settings.json` e o autostart é opt-in.
- [ ] `pnpm typecheck`, `lint`, `test`, `test:rust`, `clippy` e `pnpm tauri build` verdes; instalador gerado.
- [ ] README e docs refletem o que existe; limitações registradas.

## Fora de escopo

**Decisão de produto (não entram em nenhuma versão):** "otimização de RAM" · encerramento automático de processos · limpeza de Registro · telemetria/analytics · serviços em segundo plano · drivers · elevação permanente.

**Roadmap (não implementar sem aprovação do mantenedor):**

| ID | Item | ID | Item |
|----|------|----|------|
| B1 | Assinatura de código | B5 | Programas de inicialização |
| B2 | Auto-update (`tauri-plugin-updater`) | B6 | Histórico de limpezas |
| B3 | Categorias elevadas opt-in (Windows Update cache, Delivery Optimization) | B7 | Alertas (disco/memória) via notificação |
| B4 | Visualizador de espaço por pasta com exclusão por seleção explícita | B8 | ARM64 |

---

Contexto de produto: [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) · Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Contrato executável: [`API.md`](API.md)
