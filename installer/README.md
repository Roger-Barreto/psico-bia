# PsicoBia — Instaladores Windows

Scripts `.bat` de duplo-clique para uso por leigos no Windows 10/11.

## Como usar

1. **Install-PsicoBia.bat** — duplo-clique.
   - Instala Git e Node.js LTS via `winget` (se faltarem).
   - Clona `https://github.com/Roger-Barreto/psico-bia.git` em `%USERPROFILE%\PsicoBia`.
   - Roda `npm install` e `npm run dev`.
   - Abre `http://localhost:5173` no navegador padrão.
   - Executar de novo atualiza o repositório (`git pull`) antes de subir.

2. **Stop-PsicoBia.bat** — duplo-clique para encerrar o servidor.

## Requisitos
- Windows 10 1809+ ou Windows 11 (com **App Installer** / `winget`).
- Conexão com internet na primeira execução.

## Solução de problemas
- Se aparecer “winget não encontrado”: instalar **App Installer** pela Microsoft Store.
- Se Git/Node forem instalados mas não detectados, reiniciar o PC e executar de novo (o `PATH` precisa recarregar).
- Logs do servidor aparecem na janela **PsicoBia Server** aberta junto.
