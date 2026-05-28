# Incidente — Perda de dados (arquivos zerados para `[]`)

Postmortem + correção de um bug que esvaziava os arquivos de `data/` (todos viravam `[]`),
preservando apenas os backups.

## Sintoma

Após rodar o projeto, nenhuma informação persistida: todos os `data/*.json` continham `[]` (vazio).
Os backups em `data/.backups/<dia>/` estavam intactos.

## Causa raiz (duas falhas combinadas no `server/db.ts`)

### 1. Escrita sem `fsync` → truncamento em crash

`persist()` gravava em arquivo temporário e fazia `rename` atômico, **sem `fsync`**:

```ts
await writeFile(tmp, JSON.stringify(value, null, 2), "utf8")
await rename(tmp, fp)
```

O `rename` é atômico para *trocar* o arquivo, mas, sem flush, no **NTFS** o metadado do rename pode
persistir **antes** dos bytes do arquivo. Em caso de **crash / queda de energia / `taskkill /F`** com
escrita em voo, o arquivo final fica com **0 bytes**. Como o evento é global, vários `.json`
recentes podem zerar de uma vez.

### 2. Recuperação destrutiva no `load()`

Na inicialização seguinte, um arquivo de 0 bytes era lido como `""`; `JSON.parse("")` lança; o
`catch` então:

```ts
await rename(fp, corrupt).catch(() => {})  // move p/ .corrupt (podia falhar SILENCIOSO no Windows)
cache.set(name, fallback)                  // fallback = []
await persist(name, fallback)              // grava [] como verdade nova
```

Ou seja, a "recuperação" **gravava `[]` por cima**. A partir daí todo `update()` carregava `[]`,
mutava `[]` e persistia `[]`. Pior: se o `rename` para `.corrupt` falhasse silenciosamente (arquivo
travado por antivírus/editor/outra instância), perdia-se o dado **sem nem deixar o `.corrupt`**.

### Por que os backups sobreviveram

`persist()` chama `backupOncePerDay()` **antes** de escrever. Na primeira escrita do dia, os dados
**bons** já tinham sido copiados para `.backups/<dia>/`. Quando o `[]` foi gravado depois, o backup
do dia já estava salvo. Resultado: live `[]`, backup íntegro — exatamente o sintoma observado.

### Gatilho neste app

`Stop-PsicoBia.bat` e `Update-PsicoBia.bat` usavam **`taskkill /F`** (kill forçado, sem shutdown
gracioso). Matar o Node durante uma escrita, sem `fsync`, é a receita do truncamento. Queda de
energia / reset têm o mesmo efeito.

## Correção aplicada

### `server/db.ts`

- **Escrita durável:** `persist()` agora abre o tmp, faz `fh.sync()` (fsync do arquivo) **antes** do
  `rename`, e tenta `fsync` do diretório depois (ignorando plataformas que não suportam).
- **Salvaguarda anti-vazio:** `persist()` recusa gravar conteúdo vazio/`undefined`.
- **Recuperação não-destrutiva:** `load()` **nunca** sobrescreve um arquivo existente com fallback.
  - Arquivo vazio (`raw.trim() === ""`) → preserva cópia e **lança erro** pedindo restauração.
  - JSON inválido → preserva cópia (via `copyFile`, **sem** rename/remover o original) e **lança
    erro**.
  - `preserveSuspect()` usa `copyFile` (cópia), então uma falha aqui jamais remove o arquivo de
    dados.
- Fallback `[]` só é gravado quando o arquivo **realmente não existe** (primeira execução legítima).

### Scripts `.bat`

- `Stop-PsicoBia.bat` e a etapa de parada do `Update-PsicoBia.bat` agora encerram **gracioso
  primeiro** (`taskkill` sem `/F`), aguardam ~5s para flush em disco e **só então** forçam (`/F`) o
  que restar.

## Comportamento novo em caso de arquivo corrompido

Em vez de zerar silenciosamente, a API passa a **falhar alto** (erro 500) na coleção afetada, com
mensagem instruindo a restaurar de `data/.backups/`. Melhor recusar do que destruir.

## Recuperação manual (se acontecer de novo)

Com o **servidor parado** (o cache em memória sobrescreve edição manual):

1. Pare o servidor (`Stop-PsicoBia.bat` ou feche a janela do dev).
2. Copie os `.json` do `.backups/<dia-bom>/` por cima dos de `data/`.
3. Reinicie e confirme o carregamento antes de operar.

## Recomendações residuais

- Backups externos periódicos da pasta `data/` (o backup atual é só local).
- Não expor o dev-server; manter disco com criptografia. Ver [segurança](seguranca.md).
- Avaliar encerramento por sinal (SIGINT) no processo Node para shutdown ainda mais limpo do que o
  fechamento de janela no Windows.
