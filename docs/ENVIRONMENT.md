# ENVIRONMENT — CleanWin

> Catálogo autoritativo e conciso do ambiente: **não há `.env`** nem variável obrigatória. Este documento lista as variáveis que o **build** reconhece, as que o **app lê do Windows em runtime** (só para localizar pastas) e os **caminhos** que ele cria. Ao adicionar uma variável nova, edite este arquivo no mesmo PR.
> Relacionados: [`../CLAUDE.md`](../CLAUDE.md) · [`DEPLOY.md`](DEPLOY.md) · [`DATABASE.md`](DATABASE.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md).
> Última atualização: 04/nov/2026.

## Visão geral

```powershell
git clone https://github.com/Victorkaue333/cleanwin.git
cd cleanwin
pnpm install
pnpm tauri dev     # nada para configurar
```

> Não há segredos: o CleanWin não fala com serviço algum. A única "credencial" que o projeto um dia terá é o certificado de assinatura de código (B1), que viverá fora do repositório (secret do CI).

**Onde vive a configuração real (por destino):**

- **Usuário (runtime)** → `%APPDATA%\com.cleanwin.desktop\settings.json` (ver [`DATABASE.md`](DATABASE.md)); editável pela tela de Configurações.
- **Build** → `src-tauri/tauri.conf.json` (janela, CSP, bundle) e `src-tauri/Cargo.toml` (features do `windows` crate, perfil de release).
- **CI** → `.github/workflows/ci.yml` (versões de Node/Rust); nenhum secret.

> **Regra de ouro:** se uma funcionalidade "precisar" de uma chave ou URL externa, ela está fora do escopo do produto ([`PRD.md`](PRD.md) § Fora de escopo) e exige ADR antes de qualquer código.

## Variáveis

### Build e desenvolvimento (lidas pelo Vite / Tauri CLI — nunca pelo app em runtime)

| Variável | Obrigatória | Descrição | Onde obter |
|----------|-------------|-----------|------------|
| `TAURI_DEV_HOST` | Não | Host para o dev server/HMR quando se desenvolve com a janela em outra máquina/VM (`vite.config.ts`). Vazio = `localhost` | Definir na sessão do terminal |
| `TAURI_ENV_DEBUG` | Não | Setada pela Tauri CLI em `tauri dev`; liga `sourcemap` no build do Vite | Automática |
| `CARGO_TARGET_DIR` | Não | Redireciona `src-tauri/target` (útil em CI com cache) | Padrão do Cargo |
| `RUST_LOG` | Não | **Não lida**: o nível de log é fixo no código (`debug` em dev, `info` em release) via `tauri-plugin-log` | — |

### Runtime (lidas do Windows pelo próprio app — só para localizar pastas)

Nenhuma é configurável pelo usuário; são as variáveis padrão do perfil. Se faltarem, a categoria correspondente de limpeza simplesmente fica `available: false`.

| Variável | Usada por | Para quê |
|----------|-----------|----------|
| `TEMP` / `TMP` | `cleaner` (`user_temp`) | Raiz dos temporários do usuário |
| `LOCALAPPDATA` | `cleaner` (`browser_cache`, `crash_reports`, `shader_cache`, `thumbnail_cache`, `inet_cache`) | Caches de navegador, WER, D3DSCache, Explorer, INetCache |
| `SystemRoot` / `WINDIR` | `cleaner` (`windows_temp`) | `C:\Windows\Temp` (parcial sem admin) |
| `ProgramData` | `cleaner` (`crash_reports`) | `ProgramData\Microsoft\Windows\WER\*` (parcial sem admin) |
| `SystemDrive` | `metrics` | Marca a unidade do sistema (`isSystem`) |
| `APPDATA` | reservada | Lida para categorias futuras; não há raiz de limpeza em Roaming |

### Argumentos de linha de comando

| Argumento | Quem passa | Efeito |
|-----------|------------|--------|
| `--minimized` | Entrada de autostart (`tauri-plugin-autostart`) | A janela não é mostrada em `frontend_ready`; o app vive na bandeja. Pode ser passado à mão para testar |

## Caminhos criados pelo app

| Item | Caminho | Observação |
|------|---------|------------|
| Configurações | `%APPDATA%\com.cleanwin.desktop\settings.json` | Escrita atômica; `settings.json.invalid` guarda um arquivo corrompido |
| Logs | `%LOCALAPPDATA%\com.cleanwin.desktop\logs\` | Rotação em 2 MB (`KeepOne`) |
| Instalação (por usuário) | `%LOCALAPPDATA%\CleanWin\` | NSIS `currentUser`; `Uninstall.exe` ao lado |
| Autostart (opt-in) | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\CleanWin` = `"…\cleanwin.exe" --minimized` | Única escrita de Registro; removida ao desligar a opção |

## Versões de toolchain

| Ferramenta | Mínimo | Testado | Onde está pinado |
|------------|--------|---------|------------------|
| Rust (stable, MSVC) | **1.95** (`rust-version` no `Cargo.toml`; exigido por `sysinfo 0.40`) | 1.99.1 | `Cargo.toml` + `Cargo.lock` |
| Node.js | 20 | 24 | `package.json` (`@types/node ^24`) |
| pnpm | 9 | 11 | `pnpm-lock.yaml` |
| Tauri (crate / CLI) | 2.12 | 2.12.x | `Cargo.lock` / `package.json` |
| Windows SDK | 10.0.19041+ | 10.0.26100 | VS Build Tools 2022 |

---

Setup completo: [`development/setup.md`](development/setup.md) · Build: [`DEPLOY.md`](DEPLOY.md)
