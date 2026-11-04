# CleanWin — visão do produto

**Slogan:** Seu Windows, sob controle.

CleanWin é um utilitário de sistema open source (MIT) para Windows 10 e 11 (x64) que reúne, em uma única janela leve, o que normalmente exige três ou quatro ferramentas diferentes:

1. **Monitoramento em tempo real** de CPU, memória, armazenamento, GPU, rede, temperatura (quando o hardware expõe) e bateria.
2. **Gerenciamento de processos** com os maiores consumidores em destaque e encerramento protegido contra erros.
3. **Limpeza segura** de arquivos temporários, caches e relatórios de erro, sempre com pré-visualização e confirmação.
4. **Utilidades de manutenção**: Lixeira, manter a tela ativa, ocultar ícones da área de trabalho.

## Problemas que resolve

- Ferramentas de "otimização" tradicionais são pesadas, cheias de anúncios, pedem privilégios de administrador o tempo todo e apagam coisas demais.
- O Gerenciador de Tarefas mostra tudo, mas não ajuda a agir com segurança.
- O usuário precisa saber *o que* está ocupando espaço e *o que* será removido antes de clicar.

## Público-alvo

- Usuários domésticos que querem manter o PC rápido sem entender de sistema.
- Usuários avançados e desenvolvedores que querem uma janela compacta de métricas sempre à mão (bandeja, painel compacto).
- Técnicos que precisam de limpeza previsível e transparente.

## Princípios

- **Transparência:** cada ação mostra o que vai fazer, quanto vai liberar e o que não conseguiu fazer.
- **Segurança por padrão:** nada destrutivo sem confirmação; processos críticos e pastas pessoais são intocáveis.
- **Dados reais:** nenhuma métrica é inventada; quando o hardware não expõe, a interface diz "Não disponível".
- **Leveza:** um processo, sem serviços, sem telemetria, sem rede.
- **Identidade própria:** visual escuro com laranja como cor de ação, definido em `public/assets/design-tokens`.

## Escopo e limitações (v0.1)

- Somente Windows 10/11 x64.
- Temperatura de CPU depende de sensores expostos via WMI (raro sem elevação); temperatura de GPU apenas em NVIDIA (NVML).
- Limpeza de `C:\Windows\Temp` e `ProgramData\…\WER` é parcial sem privilégios de administrador (o app não eleva).
- Sem atualização automática: "Verificar atualizações" abre a página de releases.
- Sem assinatura de código no instalador (SmartScreen avisa na primeira execução).
