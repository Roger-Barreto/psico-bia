# Financeiro

Implementado em [`src/domain/finance.ts`](../../src/domain/finance.ts) e consumido pelo dashboard,
pela agenda e pelo controle de pagamento do drawer.

## Valor efetivo de uma sessão

```ts
effectiveValue(appt, patient) =
  appt.paidValue != null ? appt.paidValue : (patient?.consultationValue ?? 0)
```

- Se a sessão tem `paidValue` definido (pagamento com valor específico), usa-o.
- Senão, usa o `consultationValue` do paciente.
- Sem paciente conhecido → 0.

## Valor da consulta do paciente

- Definido no cadastro (`consultationValue`).
- Ao vincular um **convênio** com `defaultValue > 0`, o formulário pré-preenche esse valor
  (ajustável). Botões de atalho `+110` e `+80` somam ao valor atual.

## Falta cobrada

Alguns contratos preveem cobrança da sessão perdida. `appointments.chargedAbsence` (migração
[033](../15-falta-cobrada/033_falta_cobrada.sql)) marca a falta como cobrada: o status continua
`missed`, mas a sessão passa a valer como receita.

O predicado único está em `isBillable(appt)`
([`src/domain/finance.ts`](../../src/domain/finance.ts)):

```ts
status === "attended" || (status === "missed" && chargedAbsence)
```

- **Marcar:** o botão *Falta* abre o `MissedAppointmentDialog` com duas saídas — *Não cobrar*
  (padrão) e *Cobrar esta sessão*. Escolhendo cobrar, um segundo passo pergunta **quanto**, com o
  mesmo seletor de valor do controle de pagamento (`SessionValueField`).
- **Alternar depois:** o aviso de falta traz *Cobrar esta falta* / *Deixar de cobrar*; funciona
  também em faltas registradas antes desta funcionalidade.
- **Deixar de cobrar uma falta já paga** desmarca o pagamento junto (com confirmação). Isso
  mantém o invariante **`paid` ⇒ `isBillable`** — sem ele sobraria uma linha paga fora do
  ledger que continuaria somando no KPI "Faturado".
- **Valor:** por padrão o cheio do cadastro. Cobrando menos (ex.: 50% por falta sem aviso), o
  valor escolhido é gravado em `paidValue` já na hora de registrar a falta — então o "a receber"
  do dashboard e a linha do ledger **já mostram o valor certo antes do pagamento**. Só é gravado
  quando difere do padrão; igual ao padrão, a sessão segue o `consultationValue` do paciente,
  como as atendidas. O `PaymentControl` parte desse valor quando existe.
- Falta cobrada **não** abre checklist nem gera pendência de checklist — o alerta dela é
  financeiro (`isUnpaidBillable`).

## Pacote de sessões

O paciente fecha N sessões por um valor combinado e paga na hora (migração
[034](../16-pacotes-sessoes/034_pacotes_sessoes.sql); tudo em
[pacotes de sessões](../16-pacotes-sessoes/README.md)).

- **Regime de caixa:** o valor do pacote entra inteiro no **dia da venda**.
- As sessões que o pacote paga ficam `paid = true` com `paidValue = 0` e `packageId`
  preenchido. Como `effectiveValue` devolve `paidValue`, elas valem **0** em todos os
  agregados sem nenhum caso especial — e não são "não pagas".
- Quem desconta a sessão do pacote é o **banco** (trigger), na hora em que ela vira
  cobrável. `isBillable` não mudou: falta cobrada também consome pacote.
- Os agregados somam a venda à parte, pela data dela (`packagesSoldInRange`).

## Pagamento de uma sessão

Controlado em [`payment-control.tsx`](../../src/components/patient/payment-control.tsx), visível no
drawer quando a sessão está **atendida** ou é uma **falta cobrada**.

- **Marcar como paga** tem três caminhos:
  - **Sessão avulsa** — define `paid = true`, `paidValue` (valor padrão do cadastro **ou** valor
    customizado da sessão se o usuário marcar "usar valor diferente"), `paidAt = now`.
  - **Novo pacote** — quantidade de sessões + valor total; cria o pacote e, por padrão, já
    desconta esta sessão como a 1ª.
  - **Descontar do pacote** — só aparece quando o paciente tem pacote com saldo (e já vem
    escolhido); grava apenas o vínculo, o resto é do banco.
- **Sessão paga por pacote** mostra *"Paga pelo pacote · sessão X de N"* e *Tirar do pacote*.
- **Desmarcar:** confirma e zera `paid = false`, `paidValue = null`, `paidAt = null`.
- Validação: valor finito e ≥ 0.

## Agregações financeiras

### `totalRevenue(appts, patientsById)` — Faturado

Soma de `effectiveValue` de todas as sessões com `paid === true`. No dashboard, mais o valor
dos **pacotes vendidos no período**.

### `pendingRevenue(appts, patientsById, today)` — Pendente

Soma de:
- Cobráveis (atendidas ou faltas cobradas) **não pagas** → `effectiveValue`.
- `scheduled` com `date < today` → `consultationValue` do paciente (expectativa de receita).

### Estimado (no dashboard)

Calculado em `dashboard.tsx` materializando as ocorrências do mês por paciente
(`occurrencesForPatient`) e somando, para cada ocorrência:
- com override `cancelled`, ou `missed` **sem** cobrança → ignora;
- com override → `effectiveValue`;
- sem override (virtual) → `consultationValue`.

Representa o **potencial de faturamento do mês** se tudo for atendido.

Com pacotes: soma os **pacotes vendidos no mês** e **pula** as ocorrências que o saldo de um
pacote vai pagar (`projectedCoverage`) — senão uma sessão já paga lá atrás contaria como receita
nova. A projeção distribui o saldo pelas ocorrências ainda não concluídas do paciente, em ordem
de data, a partir do dia da venda.

### `formatBRL(n)`

`n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })` → `R$ 1.234,56`.

## Medidor financeiro (FinancialGauge)

[`financial-gauge.tsx`](../../src/components/dashboard/financial-gauge.tsx) — meia-lua (RadialBar do
Recharts) que compara:

- **Estimado** (rótulo central) — teto/eixo do medidor.
- **Faturado** (verde) — `revenue`.
- **Pendente** (âmbar) — `pendingRevenue`.
- Badge "% realizado" = `(faturado + pendente) / estimado × 100`.
- Atalho clicável "N não pagos · R$ X" → abre o diálogo de pacientes não-pagos.

O subtítulo deixa explícito o critério do estimado: *"Agendados, sem faltas/reagendados de outro
mês"*.

## Relatórios financeiros no dashboard

- **KPIs:** Atendidos, Faltas, Em tratamento, Encerrados (total + no mês), Novos no mês, Total de
  sessões do mês.
- **Faturamento por dia:** barras por dia do mês (apenas sessões pagas).
- **Faturamento mensal:** últimos 6 meses (query de intervalo estendido `useAppointmentsInRange` de 6
  meses).
- **Top pacientes:** por nº de sessões atendidas (top 10).
- **Lista de não-pagos:** agrega atendidos não pagos por paciente, ordenada por valor; clicar abre o
  drawer naquela sessão.

## Observações

- "Pagamento" é um **marcador interno de controle** — não há emissão fiscal, recibo nem integração
  com gateway.
- Sessões de pacientes **arquivados** são excluídas dos cálculos do dashboard (filtro por
  `patientsById.has(...)`).
- Pacientes **encerrados** (com alta) continuam contando em métricas históricas, mas não entram em
  recortes "em tratamento" (gênero/convênio) nem geram novas ocorrências.
