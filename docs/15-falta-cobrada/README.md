# Falta cobrada — evoluções

| Migração | O quê |
|---|---|
| [`033_falta_cobrada.sql`](033_falta_cobrada.sql) | `appointments.charged_absence` — falta que continua sendo cobrada. Acrescenta o terceiro braço do `finance_ledger`. |

## 033 — Falta cobrada

**Motivo:** alguns contratos preveem cobrança da sessão perdida quando o
paciente não avisa com antecedência. Antes disso, o único jeito de registrar
a cobrança era marcar a sessão como **atendida** — o que estragava o KPI de
faltas, abria o checklist e gerava pendências de uma sessão que não houve.

**Aplicar:** SQL Editor do Supabase → colar o arquivo → Run. (Ou via MCP
`apply_migration`.) **Rode a migração ANTES de publicar o frontend:** o
`useUpsertAppointment` passa a enviar `charged_absence` na row, e contra um
banco sem a coluna o PostgREST responde `PGRST204` — marcar atendido, marcar
falta e reagendar parariam de funcionar por completo.

A ordem inversa é segura: enquanto nenhuma linha tiver `charged_absence = true`,
o braço 3 do ledger não devolve nada e a saída do `finance_ledger` é idêntica
à de antes.

## Decisões de modelagem

**Por que uma coluna booleana, e não um novo status.** Um `missed_charged` no
CHECK obrigaria a revisar todo `if`/`switch` de status do app; onde se
esquecesse um, o valor cairia no ramo "scheduled" — e uma falta cobrada
passada viraria pendência falsa em
[`pendencyBreakdown`](../../src/domain/pendencies.ts), contaminando o banner de
pendências e três indicadores do dashboard. Com a flag, **esquecer um ponto
degrada para o comportamento de hoje** (falta comum): falha segura.

**Por que a view `finance_clinic_income` não foi tocada.** O SQL dela nunca
foi versionado (migrations 012–016 saíram via MCP). Reescrevê-la às cegas
arriscava perder o `with (security_invoker = true)` — sem o qual a view roda
com as permissões do dono e **ignora o RLS** — e esbarrar na ordem de colunas
de que o `finance_ledger` depende. Em vez disso a falta cobrada entra como um
**terceiro braço** do `finance_ledger`, cuja definição completa está
versionada em [`022_cofrinhos.sql`](../11-cofrinhos/022_cofrinhos.sql). Os
braços são disjuntos (`attended` × `missed + charged_absence`).

**Categoria própria.** O braço 3 devolve `category_name = 'Faltas cobradas'`
(o braço de atendimentos devolve `null`, e o front rotula como
"Atendimentos"). Assim a falta cobrada vira fatia própria no gráfico por
categoria e filtro próprio na lista de lançamentos, em vez de se misturar ao
faturamento de sessões realizadas.

**A restrição `charged_absence = false or status = 'missed'`** impede o estado
latente "reagendei e a flag sobreviveu", que voltaria a cobrar sozinho se a
ocorrência virasse falta de novo.

## Impacto no código

- `Appointment.chargedAbsence` ([`src/db/types.ts`](../../src/db/types.ts)).
- `isBillable(appt)` ([`src/domain/finance.ts`](../../src/domain/finance.ts)) —
  "esta sessão gera receita?" = atendida **ou** falta cobrada. Substitui os
  `status === "attended"` espalhados pelos agregados financeiros.
- `isUnpaidBillable` ([`src/domain/pendencies.ts`](../../src/domain/pendencies.ts)),
  antes `isUnpaidAttended`.
- `MissedAppointmentDialog`
  ([`src/components/appointments/missed-appointment-dialog.tsx`](../../src/components/appointments/missed-appointment-dialog.tsx))
  — escolha "Não cobrar" / "Cobrar esta sessão" ao marcar falta, e um segundo passo para definir
  quanto cobrar.
- `SessionValueField` / `useSessionValue`
  ([`src/components/patient/session-value-field.tsx`](../../src/components/patient/session-value-field.tsx))
  — o seletor "usar valor diferente" foi **extraído** do `PaymentControl` para ser compartilhado
  com o diálogo de falta. Os dois se comportam igual por construção, não por cópia.
- O `PaymentControl` passa a aparecer também na falta cobrada. Desligar a
  cobrança de uma falta já paga limpa o pagamento no mesmo patch — mantém o
  invariante **`paid` ⇒ `isBillable`**, sem o qual o KPI "Faturado" divergiria
  do ledger.

## Efeitos colaterais conhecidos

- **Cofrinhos com meta percentual sobre receita clínica**
  ([`src/domain/cofrinhos.ts`](../../src/domain/cofrinhos.ts)) calculam a meta
  a partir da receita recebida por dia. Cobrar e quitar uma falta **antiga**
  cria retroativamente um lembrete de guardar naquele dia.
- **Paciente arquivado:** o braço 3 exige `p.active`, igual ao de
  atendimentos. Arquivar um paciente remove as faltas cobradas dele do ledger,
  inclusive em meses já fechados.
