# Glossário

Termos do domínio, exatamente como usados no código e na interface.

| Termo | Em código | Definição |
|---|---|---|
| **Paciente** | `Patient` | Pessoa atendida. Tem valor de consulta, convênio opcional, checklist individual, anotações, documentos e estado de tratamento (ativo / encerrado). |
| **Série de atendimento** | `AppointmentSeries` | Definição de um agendamento: data de início, horário, frequência (`null` = único, ou semanal/quinzenal/mensal) e data final opcional. A partir dela as ocorrências são **calculadas**, não gravadas. |
| **Ocorrência** | `Occurrence` | Instância concreta de uma sessão numa data específica. **Derivada** (nunca persistida) a partir de uma série + overrides. |
| **Atendimento / Override** | `Appointment` | Registro persistido que sobrescreve uma ocorrência: guarda status, pagamento, checklist marcado, snapshot, notas, reagendamento. Existe só quando há um estado a salvar. |
| **originDate** | `originDate` | Data "âncora" da ocorrência dentro da série (a data calculada original). Chave de upsert junto com `seriesId`. |
| **date** | `date` | Data efetiva da sessão (igual à `originDate`, exceto quando reagendada — aí vira a nova data). |
| **rescheduledTo** | `rescheduledTo` | Nova data quando o status é `rescheduled`. |
| **Status da ocorrência** | `AppointmentStatus` | `scheduled` \| `attended` \| `missed` \| `rescheduled` \| `cancelled`. |
| **Checklist compartilhado** | `SharedChecklistItem` | Lista global de itens herdada por todo paciente em toda sessão. |
| **Checklist individual** | `IndividualChecklistItem` | Itens extras específicos de um paciente. Default vazio. |
| **Checklist do dia** | — | União `compartilhado ∪ individual(paciente)` exibida na sessão. |
| **Snapshot** | `snapshotItemIds` | IDs dos itens de checklist vigentes no momento em que a sessão foi concluída (atendida/falta). Congela o passado. |
| **Itens marcados** | `checkedItemIds` | IDs de itens do checklist já cumpridos naquela sessão. |
| **Pendência** | `pendencyCount` | Ação que o psicólogo precisa tomar: item de checklist não marcado em sessão passada/concluída, ou sessão `scheduled` cuja data já passou (precisa confirmar atendido/falta). |
| **Não pago** | `isUnpaidAttended` | Sessão `attended` com `paid = false`. **Não** conta como pendência — é alerta financeiro separado. |
| **Convênio** | `Insurance` | Plano de saúde com `defaultValue` que sugere o valor da consulta. |
| **Motivo de encerramento** | `DischargeReason` | Razão da alta (ex.: "Alta terapêutica"). |
| **Encerramento / Alta** | `dischargedAt`, `dischargeReasonId` | Tratamento finalizado numa data, com motivo. Mantém histórico, remove agendamentos futuros, pode ser reaberto. |
| **Anotação** | `PatientAnnotation` | Nota livre de texto associada a um paciente. |
| **Documento** | `PatientDocument` | Arquivo anexado ao paciente, salvo no sistema de arquivos sob `data/patient-documents/`. |
| **Valor efetivo** | `effectiveValue` | Valor financeiro de uma sessão: `paidValue` se definido, senão `consultationValue` do paciente. |
| **Estimado** | — | Faturamento previsto do mês (todas as ocorrências exceto faltas/cancelamentos). |
| **Faturado** | `revenue` | Soma das sessões pagas. |
| **Pendente (financeiro)** | `pendingRevenue` | Atendidos não pagos + agendados com data passada. |

### Gestão financeira (módulo `/financeiro`)

| Termo | Em código | Definição |
|---|---|---|
| **Lançamento** | `Transaction` | Receita (`income`) ou despesa (`expense`) do ledger. |
| **Escopo** | `scope` | `clinic` (PJ) \| `personal` (PF). |
| **Competência** | `date` / `period` | Data que define o **mês** do valor (`period = YYYY-MM`). Ignora ciclo de fatura. |
| **Quitado** | `settled` | Flag pago/recebido (+ `settledAt`). |
| **Categoria** | `FinanceCategory` | Rótulo do usuário p/ análise (compartilhado receita+despesa). |
| **Forma de pagamento** | `PaymentMethod` | PIX/Dinheiro/Débito/Crédito/…; `isLoan` marca empréstimo. |
| **Pessoa** | `Person` | Contraparte de empréstimo. |
| **Empréstimo** | `isLoan` + `personId` | Despesa+loan = *eu devo*; receita+loan = *me devem*. Saldo = não quitados. |
| **Recorrência** | `RecurringRule` | Template mensal infinito; gera linhas sob demanda. |
| **Parcelamento** | `installmentGroup` | N lançamentos iguais em N meses. |
| **Receita clínica (derivada)** | `finance_clinic_income` | Faturamento read-only vindo de `appointments` atendidas. |
| **Ledger** | `finance_ledger` | UNION de lançamentos manuais + receita clínica derivada. |

## Prefixos de ID

IDs gerados com `nanoid(10)` + prefixo da coleção:

| Prefixo | Coleção |
|---|---|
| `p_` | Paciente |
| `as_` | Série de atendimento |
| `ap_` | Atendimento (override) |
| `sc_` | Item de checklist compartilhado |
| `ci_` | Item de checklist individual |
| `ins_` | Convênio |
| `dr_` | Motivo de encerramento |
| `an_` | Anotação |
| `per_` | Pessoa (financeiro) |
| `cat_` | Categoria financeira |
| `pm_` | Forma de pagamento |
| `rec_` | Regra de recorrência |
| `tx_` | Lançamento financeiro |
| `ins_` (`installment_group`) | Grupo de parcelas |
| `lnk_` | Vínculo empréstimo concedido |
