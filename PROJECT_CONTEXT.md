# PROJECT_CONTEXT — CleanWin

> Contexto de produto e do problema. Camada fina: diz **por quê** o CleanWin existe e **para quem**; o **quê** está em [`docs/PRD.md`](docs/PRD.md) e o **como** em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
> Última atualização: 04/nov/2026 · Mantenedor: Victor Alves.

## O produto em uma frase

**CleanWin** é um utilitário de sistema open source (MIT) para Windows 10 e 11 que mostra, em uma janela leve, o que está consumindo o PC e permite agir com segurança: finalizar processos, limpar arquivos temporários com pré-visualização e confirmação, esvaziar a Lixeira, manter a tela ativa e organizar a área de trabalho — **sem telemetria, sem serviços em segundo plano e sem pedir administrador**.

**Slogan:** *Seu Windows, sob controle.*

## O problema

| Dor | Como o mercado responde | O que fica faltando |
|-----|-------------------------|---------------------|
| O PC está lento e o usuário não sabe o que pesa | Gerenciador de Tarefas mostra tudo, sem hierarquia nem ação segura | Visão rápida (compacta) e ações com confirmação |
| Disco cheio de temporários e caches | "Otimizadores" pesados, com anúncios, upsell e exclusões agressivas | Transparência: o que será removido, quanto libera, o que não conseguiu |
| Ferramentas pedem administrador o tempo todo | Elevação permanente, serviços, alterações de Registro | Menor privilégio: fazer o que dá como usuário e dizer o que ficou parcial |
| Métricas inventadas ("RAM otimizada em 40 %") | Marketing em vez de medição | Dados reais ou "Não disponível" |

## Para quem

- **Usuário doméstico** que quer manter o PC rápido sem entender de sistema — usa o painel compacto e o botão "Escanear lixo".
- **Usuário avançado / desenvolvedor** que quer métricas à mão (bandeja, painel compacto sempre aberto) e um gerenciador de processos honesto.
- **Técnico de suporte** que precisa de uma limpeza previsível, auditável e sem surpresas.

## Princípios inegociáveis

1. **Segurança por padrão.** Nada destrutivo sem confirmação explícita; processos críticos e pastas pessoais são intocáveis; a interface nunca envia caminhos para exclusão (sessão de scan no Rust).
2. **Dados reais.** Nenhuma métrica simulada. Quando o hardware ou o driver não expõe (temperatura, GPU), a interface diz "Não disponível" ou "Não suportado".
3. **Leveza.** Um processo, uma thread de métricas, intervalo adaptativo quando a janela está oculta. Sem servidor local, sem banco de dados, sem rede.
4. **Transparência.** Cada ação mostra o que vai fazer, quanto liberou e o que ficou em uso ou falhou.
5. **Identidade própria.** Visual escuro com laranja como cor de ação, definido pelo mantenedor em [`public/assets/`](public/assets/README-ASSETS.md) — nunca redesenhado pelo código.

## O que o CleanWin **não** é

- Não é "otimizador de RAM", não encerra processos sozinho, não mexe no Registro além da entrada opt-in de autostart.
- Não é antivírus nem ferramenta de reparo do Windows.
- Não coleta dados, não tem conta, não tem nuvem.

## Linha do tempo

| Data | Marco |
|------|-------|
| 04/nov/2026 | v0.1.0 — primeira entrega completa: núcleo Rust (métricas, processos, limpeza, utilidades, bandeja, configurações), interface React (painel compacto + janela completa), instalador NSIS, documentação e CI |
| próximo | v0.2 — assinatura de código, auto-update, categorias elevadas opt-in ([roadmap](docs/project-context/roadmap.md)) |

## Onde aprofundar

- Visão e escopo: [`docs/project-context/overview.md`](docs/project-context/overview.md)
- Requisitos: [`docs/PRD.md`](docs/PRD.md) → [`docs/project-context/product-requirements.md`](docs/project-context/product-requirements.md)
- Decisões: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Segurança: [`docs/architecture/security.md`](docs/architecture/security.md)
