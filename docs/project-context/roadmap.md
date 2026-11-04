# Roadmap

## v0.1 (esta entrega)

- Dashboard compacto e janela completa com métricas reais (CPU, RAM, discos, GPU, rede, bateria, uptime, saúde).
- Processos: lista, busca, ordenação, finalizar com confirmação e proteção.
- Limpeza: 7 categorias, scan sem exclusão, pré-visualização, confirmação, progresso, cancelamento, relatório.
- Lixeira, manter tela ativa, ocultar ícones da área de trabalho.
- Bandeja, comportamento ao fechar, iniciar com o Windows (opt-in), iniciar minimizado.
- Instalador NSIS por usuário; CI com typecheck, lint, testes e build.

## v0.2

- Assinatura de código do instalador (certificado do mantenedor) para remover o aviso do SmartScreen.
- Atualização automática com `tauri-plugin-updater` e releases assinadas no GitHub.
- Categorias adicionais de limpeza com consentimento específico: cache do Windows Update (`SoftwareDistribution\Download`), logs de instalação, Delivery Optimization — exigem modo elevado opcional ("Executar como administrador" por sessão, nunca permanente).
- Exclusão de arquivos pessoais grandes por **seleção explícita do usuário** (visualizador de espaço por pasta), nunca automática.
- Temperatura de CPU por sensores adicionais (ex.: integração opcional com LibreHardwareMonitor em execução), mantendo "Não disponível" como padrão honesto.

## v0.3

- Programas de inicialização (listar e desativar entradas `Run`/Startup com confirmação).
- Histórico de limpezas e espaço recuperado acumulado.
- Alertas configuráveis (disco cheio, memória crítica) via notificação do Windows.
- Suporte a ARM64.

## Fora de escopo (decisão de produto)

- "Otimização de RAM", encerramento automático de processos, limpeza de Registro.
- Telemetria, anúncios, serviços em segundo plano, drivers.
