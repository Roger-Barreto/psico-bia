# Fluxos de Uso

Passo a passo dos principais fluxos, com os efeitos de dados de cada ação.

## Agendar um atendimento

Origem: botão **"Novo atendimento"** na Agenda →
[`schedule-appointment-dialog.tsx`](../../src/components/appointments/schedule-appointment-dialog.tsx).

1. Escolher paciente (combobox com busca normalizada por acento; só pacientes ativos e não
   encerrados).
2. Definir data e horário (default: dia selecionado / 08:00).
3. Tipo: **Único** (`frequency=null`) ou **Recorrente** (semanal/quinzenal/mensal + data final
   opcional).
4. `POST /api/appointment-series` cria a **série**. Nenhum `Appointment` é criado ainda — as
   ocorrências passam a ser calculadas.
5. Invalida caches de `series` e `appointments` → a agenda atualiza.

## Concluir uma sessão (atendido)

Origem: clicar num card da Agenda (ou item de pendência no Dashboard) → abre o
[`patient-drawer.tsx`](../../src/components/patient/patient-drawer.tsx).

1. Botão **Atendido** (só habilitado se a sessão não é futura e ainda não tem status final).
2. `markAttended` → `POST /api/appointments` (upsert por `seriesId`+`originDate`) com
   `status=attended` e `snapshotItemIds` = snapshot do checklist vigente (se ainda não houver).
3. Confete "happy" + toast.
4. A seção **Pagamento** e o **Checklist do dia** aparecem.
5. Marcar itens do checklist → `PATCH /api/appointments/:id { checkedItemIds }` com **update
   otimista** em todos os ranges de cache.

## Registrar falta

1. Botão **Falta** → confirmação.
2. `markMissed` → upsert `status=missed` + snapshot.
3. Confete "sad" + toast.
4. Itens não cumpridos do snapshot contam como pendência.

## Reagendar

1. Botão **Reagendar** (sempre disponível, inclusive em sessões já com status).
2. Escolher nova data + horário.
3. `reschedule` → upsert `status=rescheduled`, `date=novaData`, `rescheduledTo=novaData`, `time`.
4. A ocorrência some da data de origem e aparece na nova data. Fecha o drawer.

## Marcar pagamento

1. Sessão atendida → seção **Pagamento** no drawer.
2. "Marcar como paga" → opcional "usar valor diferente nesta sessão".
3. `PATCH /api/appointments/:id { paid:true, paidValue, paidAt }`. Confete.
4. Para reverter: "Desmarcar" (confirma) → `paid:false, paidValue:null, paidAt:null`.

## Desfazer atendimento (escopos)

Origem: botão **Desfazer** no drawer →
[`undo-appointment-dialog.tsx`](../../src/components/appointments/undo-appointment-dialog.tsx) →
`POST /api/appointments/bulk-delete`.

| Escopo | Efeito |
|---|---|
| **Apenas este** (`one`) | Série recorrente: cria/atualiza override `cancelled` (oculta a data, limpa status/pagamento/checklist/notas). Atendimento avulso (`frequency=null`): apaga a série inteira. |
| **Este e os próximos** (`future`) | Encerra a série em `originDate - 1 dia` e apaga os atendimentos com `originDate >= origin`. Se a nova data final ficar antes do início, apaga a série inteira. Ocorrências passadas permanecem. |
| **Todos** (`all`) | Apaga a série e **todos** os atendimentos (passados e futuros). |

Resposta: `{ removedCount, cancelledCount, seriesDeleted }`. Todas as variações são **irreversíveis**.

## Encerrar tratamento

Ver [ciclo de vida — encerramento](ciclo-de-vida-paciente.md#4-encerramento-alta). Resumo: aba
**Tratamento** do formulário → data + motivo → prévia de futuros a remover → confirmar.

## Anexar documento

Aba **Documentos** do paciente →
[`patient-documents.tsx`](../../src/components/patient/patient-documents.tsx).

1. Arrastar arquivos ou clicar em **Anexar** (multi-arquivo).
2. `POST /api/patients/:id/documents` (multipart/form-data, parseado com `busboy`).
3. Arquivo salvo em `data/patient-documents/<slug>-<id>/` com nome único se houver colisão.
4. Download via link direto; exclusão com confirmação; "Abrir pasta no Explorer" (chama o explorador
   de arquivos do SO no servidor local).

## Adicionar anotação

Drawer → **+ Anotação** → diálogo → `POST /api/patient-annotations { patientId, text }`. Listadas no
drawer, decrescente por data; exclusão com confirmação.

## Configurar cadastros auxiliares

- **Checklist compartilhado** (`/checklist`): adicionar/editar/arquivar/restaurar itens globais.
- **Convênios** (`/insurances`): nome + valor padrão; arquivar/restaurar.
- **Motivos de encerramento** (`/discharge-reasons`): nome; arquivar/restaurar.

## Perfil e senha

Menu do avatar (topo) → **Meu perfil** →
[`profile-drawer.tsx`](../../src/components/profile/profile-drawer.tsx).

- Atualizar nome de exibição + avatar (`PATCH /api/me`).
- Trocar senha (`POST /api/me/password`): exige senha atual correta; nova com mín. 8 caracteres;
  confirmação.
- O **login (username) não pode ser alterado**.
