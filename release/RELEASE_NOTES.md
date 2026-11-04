# CleanWin 0.1.0 — primeira versão

Utilitário de sistema open source para Windows 10 e 11, leve e sem telemetria. Inclui:

- monitoramento em tempo real (CPU, RAM, disco, GPU, rede);
- limpeza segura de temporários, com pré-visualização e confirmação;
- gerenciamento de processos com proteções;
- Lixeira, manter tela ativa e limpar a tela (ícones da área de trabalho);
- ícone na bandeja, painel compacto e janela completa;
- interface em pt-BR e en-US.

## Como instalar

1. Baixe `CleanWin_0.1.0_x64-setup.exe` nos anexos desta Release.
2. Execute o instalador. A instalação é por usuário e não pede UAC (administrador).
3. O instalador ainda **não é assinado**, então o SmartScreen pode mostrar "editor desconhecido": clique em **Mais informações** e depois em **Executar assim mesmo**.

## Requisitos

- Windows 10 ou 11 x64.
- WebView2 Runtime (o instalador baixa se faltar).

## Verificação

O SHA-256 do instalador está em `SHA256SUMS.txt` (anexo desta Release). Para conferir no PowerShell, na pasta do download:

```powershell
Get-FileHash CleanWin_0.1.0_x64-setup.exe -Algorithm SHA256
```

Para conferir:

```powershell
Get-FileHash -Algorithm SHA256 .\CleanWin_0.1.0_x64-setup.exe
```

## Limitações conhecidas

- Temperatura de CPU só aparece com sensores WMI disponíveis e sem elevação; caso contrário mostra "Não disponível".
- Temperatura de GPU só para placas NVIDIA.
- `C:\Windows\Temp` é limpo parcialmente sem administrador.
- Sem atualização automática nesta versão.

## Privacidade

Sem telemetria e sem acesso à rede.

## Documentação

- [README](https://github.com/Victorkaue333/cleanwin/blob/main/README.md)
- [Índice da documentação](https://github.com/Victorkaue333/cleanwin/blob/main/docs/INDEX.md)

## Aviso: possível falso positivo do Windows Defender

O instalador e o `cleanwin.exe` ainda **não são assinados digitalmente**. Em alguns PCs o Windows Defender classifica o binário como `Trojan:Win32/Bearfoos.A!ml` (detecção heurística "!ml", não uma assinatura de malware conhecida) e o coloca em quarentena. O código-fonte é aberto e este instalador é gerado pelo CI público do repositório.

Se isso acontecer: confira o SHA-256 em `SHA256SUMS.txt` (anexo desta release), abra **Segurança do Windows › Histórico de proteção** e escolha "Permitir no dispositivo", ou aguarde a versão assinada (planejada para a v0.2). Você também pode reportar o falso positivo à Microsoft em https://www.microsoft.com/wdsi/filesubmission.
