# Instalação (Windows)

Scripts `.bat` de duplo-clique para usuários leigos, em [`installer/`](../../installer/). Pensados
para Windows 10 (1809+) / 11 com `winget` (App Installer).

## `Install-PsicoBia.bat`

Fluxo completo (5 etapas):

1. Verifica `winget` (aborta com instrução se ausente).
2. Instala **Git** via `winget install Git.Git` (se faltar); adiciona ao PATH da sessão.
3. Instala **Node.js LTS** via `winget install OpenJS.NodeJS.LTS` (se faltar).
4. **Clona** `https://github.com/Roger-Barreto/psico-bia.git` em `%USERPROFILE%\PsicoBia`
   (ou `git pull --rebase --autostash` se já existir).
5. `npm install` → inicia `npm run dev` em janela separada ("PsicoBia Server") → aguarda a porta
   responder (até 60s) → abre `http://localhost:5173` no navegador.

Reexecutar o instalador atualiza o repositório antes de subir.

## `Start-PsicoBia.bat`

Inicia depois de já instalado, sem reinstalar dependências:
- Verifica `%USERPROFILE%\PsicoBia\package.json` e Node no PATH.
- Se o servidor já responde em `:5173`, apenas abre o navegador.
- Senão, sobe `npm run dev` e aguarda ficar pronto.

## `Update-PsicoBia.bat`

Atualiza a instalação:
1. Garante Git/Node no PATH.
2. Encerra o servidor em execução (por título de janela e por PID na porta).
3. Captura `HEAD`, faz `git pull --rebase --autostash`, compara `HEAD`.
4. `npm install` (sempre, para sincronizar dependências).
5. Instrui a usar `Start-PsicoBia.bat` para iniciar.

## `Stop-PsicoBia.bat`

Encerra o servidor:
- `taskkill` pela janela "PsicoBia Server" (e variante "Administrator:").
- Mata o processo que escuta a porta 5173 (via `netstat`/`taskkill`).
- Mata processos `node.exe` órfãos cujo command line contém "PsicoBia" (via `wmic`).

## Requisitos

- Windows 10 1809+ ou Windows 11 com **App Installer** (`winget`).
- Internet na primeira execução (clone + winget + npm).

## Solução de problemas (do README do instalador)

- "winget não encontrado" → instalar **App Installer** pela Microsoft Store.
- Git/Node instalados mas não detectados → reiniciar o PC (PATH precisa recarregar).
- Logs do servidor na janela **PsicoBia Server**.

> Porta fixa **5173** (`strictPort: true`). O `.claude/launch.json` (dev em IDE) usa 5174 com
> `autoPort`.
