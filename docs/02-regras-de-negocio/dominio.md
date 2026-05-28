# Domínio — Conceitos e Relações

Este documento descreve o modelo conceitual e as regras que o regem. Para as fórmulas exatas, ver
os documentos específicos de [recorrência](recorrencia.md), [pendências](pendencias.md) e
[financeiro](financeiro.md).

## Entidades e relacionamentos

```
Insurance (Convênio) ──< Patient (Paciente) >── DischargeReason (Motivo de encerramento)
                              │  1
                              ├──< AppointmentSeries (Série)
                              │         │  1
                              │         └──< Appointment (Atendimento/override)
                              ├──< IndividualChecklistItem (Checklist individual)
                              ├──< PatientAnnotation (Anotação)
                              └──< PatientDocument (Documento, no filesystem)

SharedChecklistItem (Checklist compartilhado)  — global, sem dono

Occurrence (Ocorrência) — DERIVADA: AppointmentSeries × intervalo × Appointment[]
```

- Um **paciente** tem 0..N **séries**, 0..N itens de **checklist individual**, 0..N **anotações**,
  0..N **documentos**, e pode ter um **convênio** e (quando encerrado) um **motivo de encerramento**.
- Uma **série** gera **ocorrências** calculadas; cada ocorrência pode ter (ou não) um **atendimento**
  (`Appointment`) que a sobrescreve.
- O **checklist compartilhado** é global e não pertence a ninguém.

## Paciente (`Patient`)

Campos (ver [modelo de dados](../03-arquitetura/modelo-de-dados.md) para tipos exatos):

- `name`, `gender` (`male`/`female`/`other`), `birthdate` (ISO `YYYY-MM-DD` — a **idade é derivada**,
  nunca armazenada), `avatarId` (1..56, monstrinho).
- `consultationValue` — valor padrão da consulta.
- `insuranceId` — convênio (ou `null` = particular).
- `individualChecklistItemIds` — campo legado/auxiliar (os itens individuais reais vivem na coleção
  própria, filtrados por `patientId`).
- `active` — `false` quando **arquivado** (soft-delete).
- `dischargedAt` / `dischargeReasonId` — encerramento de tratamento (ou `null` = em tratamento).
- `createdAt`.

### Regras

- **Idade:** calculada de `birthdate` via `ageFromBirthdate` (considera mês/dia para saber se já fez
  aniversário no ano). Nunca persistida.
- **Avatar:** se não informado, um monstrinho aleatório (`randomMonsterAvatarId`) é atribuído na
  criação; ao normalizar dados antigos sem avatar, usa um **determinístico** baseado no ID
  (`stableMonsterAvatarId`) para estabilidade visual.
- **Valor da consulta:** ao escolher um convênio com `defaultValue > 0`, o formulário pré-preenche o
  campo de valor (mas o usuário pode ajustar). Botões de atalho `+110` e `+80` somam ao valor atual.
- **Validação de nascimento:** obrigatória; ano entre 1900 e o ano atual; data válida; não pode estar
  no futuro.
- **Arquivar (soft-delete):** `DELETE /api/patients/:id` → `active = false`. O paciente some das
  listas mas seus dados permanecem. Pode ser reexibido com "Mostrar arquivados".
- **Excluir permanentemente:** `DELETE /api/patients/:id/permanent` → remove o paciente **e** todas
  as séries, atendimentos, anotações, itens de checklist individual e a pasta de documentos. Ação
  irreversível, confirmada explicitamente.

## Série de atendimento (`AppointmentSeries`)

Representa a **intenção** de agendar. Campos: `patientId`, `startDate`, `time` (`HH:MM`),
`frequency` (`null` | `weekly` | `biweekly` | `monthly`), `endDate` (`null` ou ISO), `createdAt`.

### Regras

- `frequency === null` → **atendimento único** (só existe em `startDate`).
- `weekly` → a cada 7 dias a partir de `startDate`.
- `biweekly` → a cada 14 dias a partir de `startDate`.
- `monthly` → mesmo dia-do-mês de `startDate`, com **fallback ao último dia do mês** quando o dia não
  existe (ex.: dia 31 em fevereiro vira 28/29).
- `endDate` limita a geração de ocorrências (inclusive).
- Excluir uma série (`DELETE /api/appointment-series/:id`) remove também todos os atendimentos
  daquela série.

Detalhes algorítmicos em [recorrência](recorrencia.md).

## Atendimento / Override (`Appointment`)

Só existe quando há **estado a persistir** sobre uma ocorrência (status diferente de "virtual",
pagamento, checklist marcado, notas, reagendamento). Campos principais:

- `seriesId`, `patientId`, `originDate`, `date`.
- `status`: `scheduled` | `attended` | `missed` | `rescheduled` | `cancelled`.
- `rescheduledTo` — destino quando reagendado.
- `time` — horário específico (sobrescreve o da série; `null` herda da série).
- `checkedItemIds` — itens cumpridos.
- `snapshotItemIds` — itens vigentes no fechamento (congelado).
- `notes`, `updatedAt`.
- `paid`, `paidValue`, `paidAt` — controle de pagamento.

### Chave de unicidade

Atendimentos são **upsertados** por `(seriesId, originDate)`. Não pode haver dois overrides para a
mesma ocorrência de origem.

### Snapshot — por quê

Quando a sessão é concluída (`attended` ou `missed`), grava-se `snapshotItemIds` com os IDs dos itens
**ativos** (não arquivados) naquele momento (`buildSnapshotIds`). A partir daí, o checklist e as
pendências dessa sessão usam o snapshot — então editar/arquivar itens do checklist compartilhado
**não altera sessões já fechadas**. Antes do fechamento, a ocorrência é "virtual" e usa a lista
viva.

## Status — ciclo de vida

```
        (sem override = virtual "scheduled")
                  │
   ┌──────────────┼───────────────┬─────────────┐
   ▼              ▼               ▼             ▼
attended       missed        rescheduled    cancelled
(snapshot)    (snapshot)    (date→novaData)  (oculta)
```

- **Virtual / scheduled:** ocorrência calculada sem registro próprio, ou com override `scheduled`.
- **attended:** sessão realizada → habilita checklist e controle de pagamento; grava snapshot.
- **missed:** falta → grava snapshot; itens não cumpridos contam como pendência.
- **rescheduled:** movida para `rescheduledTo`; some da data de origem, aparece na nova data.
- **cancelled:** oculta a ocorrência do calendário (usada pelo "desfazer apenas este" em séries
  recorrentes).

## Checklist

- **Compartilhado** (`SharedChecklistItem`): `label`, `order`, `archived`. Global.
- **Individual** (`IndividualChecklistItem`): igual + `patientId`.
- Itens são **arquivados** (`archived = true`), não deletados (preserva snapshots históricos).
- O **checklist do dia** de uma sessão é a união dos itens compartilhados ativos + individuais ativos
  do paciente (ou, se a sessão estiver fechada, os `snapshotItemIds`).

Cálculo detalhado em [pendências](pendencias.md).

## Convênio (`Insurance`) e Motivo de encerramento (`DischargeReason`)

- **Convênio:** `name`, `active`, `defaultValue`. O `defaultValue` sugere o valor da consulta ao
  vincular ao paciente. Arquivável (`active = false`).
- **Motivo de encerramento:** `name`, `active`. Selecionável na alta. Arquivável.

## Anotações e Documentos

- **Anotação:** texto livre (até 2000 caracteres) por paciente, com `createdAt`. Listadas
  decrescente por data. Sempre visíveis no drawer de atendimento.
- **Documento:** arquivo físico salvo em `data/patient-documents/<slug>-<id>/`. Upload por
  drag-and-drop ou seleção; download; exclusão; e botão "Abrir pasta no Explorer" (apenas local).
  Ver [segurança](../07-operacao/seguranca.md) sobre proteção contra path traversal.
