# Ciclo de Vida do Paciente

Estados e transições de um paciente, do cadastro à exclusão. Lógica em
[`patient-form.tsx`](../../src/components/patient/patient-form.tsx) (frontend) e
[`server/routes.ts`](../../server/routes.ts) (backend).

## Estados

```
        criar
          │
          ▼
   ┌─────────────┐   arquivar               ┌──────────────┐
   │ Ativo / Em  │ ───────────────────────► │  Arquivado   │
   │ tratamento  │ ◄─────────────────────── │ (active=false)│
   └─────────────┘   desarquivar            └──────────────┘
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

- Campos obrigatórios: nome. Data de nascimento é **opcional**; quando preenchida é validada (ver
  [domínio](dominio.md#regras)), gênero.
- Opcionais: avatar (aleatório se omitido), convênio, valor da consulta.
- `POST /api/patients`. `active=true`, `dischargedAt=null`.

### Casal

Um casal é um paciente com `kind = 'couple'` e as pessoas em `members` — o ciclo de vida
(arquivar, alta, reabrir, excluir) é o mesmo. Na edição dá para **converter** individual ↔
casal: o id não muda, então agenda, pagamentos, pacotes e anotações continuam. Excluir
permanentemente um paciente individual que estava vinculado a um casal desfaz o vínculo; a
pessoa segue no casal. Ver [terapia de casal](../18-casais/README.md).

## 2. Edição

- `PATCH /api/patients/:id`. Merge parcial.
- **Renomear** dispara renomeação da pasta de documentos no filesystem
  (`<slug-antigo>-<id>` → `<slug-novo>-<id>`), se a pasta existir e o destino não.
- O formulário tem abas: **Dados**, **Checklist** (individual), **Documentos**.

## 3. Arquivar (soft-delete)

- `useArchivePatient` → `active=false`. Ícone de arquivar no card da lista, com confirmação.
- Some das listas por padrão; reaparece com "Mostrar arquivados". Buscar o nome de um arquivado
  com eles ocultos avisa quantos correspondem e oferece mostrá-los.
- Dados preservados. As séries **não** são encerradas — só deixam de aparecer.
- Ocorrências de pacientes inativos **não são geradas** (`occurrencesForPatient` retorna vazio se
  `!active`).

## 3.1. Desarquivar

- Pelo ícone ↺ no card do arquivado (com "Mostrar arquivados") ou pela faixa **Paciente
  arquivado › Desarquivar** no topo do cadastro. Diálogo em
  [`unarchive-patient-dialog.tsx`](../../src/components/patient/unarchive-patient-dialog.tsx);
  `useUnarchivePatient` → `active=true`. Nada muda no banco além disso — sem migração.
- Como arquivar não encerra as séries, a recorrência "continuou correndo" escondida. Antes de
  confirmar, [`unarchivePreview`](../../src/domain/unarchive.ts) calcula:
  - **sessões sem registro** — ocorrências passadas sem linha em `appointments` depois da
    **última sessão registrada** do paciente (qualquer status). Sem esse tratamento voltariam
    todas como *Pendente* (o dashboard olha 12 meses para trás). Não há data de arquivamento
    gravada; a última sessão registrada é o marco de quando o paciente parou de vir. Sessões
    esquecidas **antes** dela já eram pendência e continuam sendo.
  - **horários que voltam** — séries com ocorrências de hoje em diante (nada, se o tratamento
    foi encerrado).
- Havendo sessões sem registro, a escolha é explícita:
  - **Cancelar as N sessões** — grava uma linha `cancelled` para cada uma (a mesma do
    *Desfazer › Apenas este*), com `ON CONFLICT DO NOTHING`: sessão registrada em outro
    aparelho no meio-tempo fica como está. Os cancelamentos são gravados **antes** de reativar;
    se falharem, o paciente continua arquivado.
  - **Manter como pendentes** — só reativa.
- Não havendo, é uma confirmação simples.

## 4. Encerramento (alta)

- `POST /api/patients/:id/discharge` com `{ dischargedAt, dischargeReasonId }`.
- Efeitos no backend (transação lógica em três updates):
  1. Marca `dischargedAt` e `dischargeReasonId` no paciente.
  2. Em cada série do paciente, se `endDate` é `null` ou posterior à data de alta → seta
     `endDate = dischargedAt` (encerra a recorrência).
  3. Remove atendimentos **futuros** do paciente com status `scheduled`/`rescheduled` e
     `date > dischargedAt` (conta `deletedAppointments`). Atendimentos **passados** e
     atendidos/faltas/cancelados permanecem para histórico.
- O **motivo** é um grupo de opções na própria tela (não um menu flutuante), com criação de
  motivo inline. Conta que ainda não cadastrou nenhum vê sugestões de um toque. Ver
  [celular](../17-mobile/README.md#2-motivo-de-encerramento).
- Se o paciente tem **pacote com sessões pagas e não realizadas**, a confirmação avisa quantas
  são. Encerrar o tratamento não encerra o pacote.
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
| Arquivado | não | não | não (filtrado) — volta ao desarquivar |
| Excluído | — | — | — (dados removidos) |
