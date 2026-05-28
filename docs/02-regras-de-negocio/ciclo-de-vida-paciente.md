# Ciclo de Vida do Paciente

Estados e transições de um paciente, do cadastro à exclusão. Lógica em
[`patient-form.tsx`](../../src/components/patient/patient-form.tsx) (frontend) e
[`server/routes.ts`](../../server/routes.ts) (backend).

## Estados

```
        criar
          │
          ▼
   ┌─────────────┐   arquivar (DELETE)      ┌──────────────┐
   │ Ativo / Em  │ ───────────────────────► │  Arquivado   │
   │ tratamento  │ ◄─────────────────────── │ (active=false)│
   └─────────────┘   (editar active=true)   └──────────────┘
       │   ▲
 alta  │   │ reabrir (reopen)
       ▼   │
   ┌─────────────┐
   │  Encerrado  │  (dischargedAt + reasonId, active permanece true)
   └─────────────┘

   Qualquer estado ──► Excluir permanentemente (irreversível, apaga tudo)
```

> **Atenção:** "Arquivado" (`active=false`) e "Encerrado" (`dischargedAt`) são **dimensões
> independentes**. Encerrar **não** arquiva: o paciente segue `active=true`, apenas com tratamento
> finalizado.

## 1. Cadastro

- Campos obrigatórios: nome, data de nascimento (validada — ver
  [domínio](dominio.md#regras)), gênero.
- Opcionais: avatar (aleatório se omitido), convênio, valor da consulta.
- `POST /api/patients`. `active=true`, `dischargedAt=null`.

## 2. Edição

- `PATCH /api/patients/:id`. Merge parcial.
- **Renomear** dispara renomeação da pasta de documentos no filesystem
  (`<slug-antigo>-<id>` → `<slug-novo>-<id>`), se a pasta existir e o destino não.
- O formulário tem abas: **Dados**, **Checklist** (individual), **Documentos**.

## 3. Arquivar (soft-delete)

- `DELETE /api/patients/:id` → `active=false`.
- Some das listas por padrão; reaparece com "Mostrar arquivados".
- Confirmação na UI. Dados preservados.
- Ocorrências de pacientes inativos **não são geradas** (`occurrencesForPatient` retorna vazio se
  `!active`).

## 4. Encerramento (alta)

- `POST /api/patients/:id/discharge` com `{ dischargedAt, dischargeReasonId }`.
- Efeitos no backend (transação lógica em três updates):
  1. Marca `dischargedAt` e `dischargeReasonId` no paciente.
  2. Em cada série do paciente, se `endDate` é `null` ou posterior à data de alta → seta
     `endDate = dischargedAt` (encerra a recorrência).
  3. Remove atendimentos **futuros** do paciente com status `scheduled`/`rescheduled` e
     `date > dischargedAt` (conta `deletedAppointments`). Atendimentos **passados** e
     atendidos/faltas/cancelados permanecem para histórico.
- A UI mostra uma **prévia** de quantos atendimentos futuros serão removidos
  (`futureOccurrenceCount`, calculada projetando ocorrências 2 anos à frente) antes de confirmar.
- Retorna `{ patient, deletedAppointments }`.

## 5. Reabrir tratamento

- `POST /api/patients/:id/reopen` → `dischargedAt=null`, `dischargeReasonId=null`.
- **Não** recria automaticamente os agendamentos futuros removidos na alta — é preciso reagendar.

## 6. Exclusão permanente

- `DELETE /api/patients/:id/permanent`. Confirmação explícita e enfática (irreversível).
- Remove em cascata: paciente, séries, atendimentos, anotações, itens de checklist individual e a
  **pasta de documentos** no filesystem.

## Efeitos colaterais nas métricas

| Estado | Aparece na agenda | Gera ocorrências | Conta no dashboard |
|---|---|---|---|
| Ativo/Em tratamento | sim | sim | sim (todas as métricas) |
| Encerrado | só histórico | não (após `dischargedAt`) | sim (histórico; fora de "em tratamento") |
| Arquivado | não | não | não (filtrado) |
| Excluído | — | — | — (dados removidos) |
