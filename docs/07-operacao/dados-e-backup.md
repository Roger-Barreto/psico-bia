# Dados, Backup e Privacidade

## Onde ficam os dados

Tudo em `data/` (relativo ao cwd do processo, normalmente a raiz do projeto):

```
data/
  patients.json
  appointment-series.json
  appointments.json
  shared-checklist.json
  individual-checklist.json
  insurances.json
  discharge-reasons.json
  patient-annotations.json
  user.json
  patient-documents/
    <slug>-<id>/            # uma pasta por paciente
      <arquivos anexados>
  .backups/
    <YYYY-MM-DD>/           # cópia diária de cada coleção
  *.<timestamp>.corrupt.json # arquivos movidos por corrupção (se ocorrer)
```

Os arquivos são criados sob demanda na primeira leitura (com `fallback` vazio) e mantidos formatados
(JSON indentado 2 espaços), então são legíveis/editáveis à mão — com cuidado.

## Privacidade / PII

- `data/` contém **dados pessoais sensíveis** (nomes, datas de nascimento, anotações clínicas,
  documentos). Permanece **somente local** — nenhuma sincronização remota.
- `.gitignore` ignora `data/` (e `proj-bia/`) — **os dados nunca são versionados**. Não commitar.

## Backup

- **Automático local:** na primeira escrita de cada coleção a cada dia, `db.ts` copia o arquivo para
  `data/.backups/<YYYY-MM-DD>/`. Mantém as **7** datas mais recentes (rotação automática).
- **Manual recomendado:** como o backup é local, copiar periodicamente a pasta `data/` para um meio
  externo (pen drive, nuvem pessoal) protege contra perda do disco. Não há automação para isso.

## Recuperação

- **Corrupção / arquivo vazio:** se um arquivo está vazio ou com JSON inválido, `load` salva uma
  **cópia** em `<name>.<timestamp>.corrupt.json` (sem tocar no original) e **falha alto** (erro 500
  naquela coleção), instruindo a restaurar do backup. **Não** sobrescreve com vazio — ver o
  postmortem em [incidente-perda-dados.md](incidente-perda-dados.md).
- **Restaurar backup:** copiar o arquivo desejado de `data/.backups/<data>/` de volta para `data/`
  (com o servidor parado, para não conflitar com o cache em memória).

> **Histórico:** uma versão anterior do `load`/`persist` podia **zerar todos os arquivos para `[]`**
> após um crash (sem `fsync`) — corrigido. Detalhes e correção em
> [incidente-perda-dados.md](incidente-perda-dados.md).

## Cache em memória

`db.ts` mantém cada coleção em memória após a primeira leitura. Edições manuais no JSON **com o
servidor rodando** podem ser sobrescritas pelo cache na próxima escrita. **Pare o servidor** antes de
editar arquivos à mão.

## Integridade e concorrência

- Escrita atômica (tmp + rename) evita arquivos parciais em crash.
- Lock por coleção (mutex em memória) serializa escritas concorrentes (last-write-wins na fila).
- Premissa **single-user / single-process**. Múltiplas instâncias apontando para o mesmo `data/`
  **não** são suportadas (caches independentes poderiam divergir).
