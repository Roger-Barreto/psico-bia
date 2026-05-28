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

## Pagamento de uma sessão

Controlado em [`payment-control.tsx`](../../src/components/patient/payment-control.tsx), visível no
drawer apenas quando a sessão está **atendida**.

- **Marcar como paga:** define `paid = true`, `paidValue` (valor padrão do cadastro **ou** valor
  customizado da sessão se o usuário marcar "usar valor diferente"), `paidAt = now`. Dispara confete.
- **Desmarcar:** confirma e zera `paid = false`, `paidValue = null`, `paidAt = null`.
- Validação: valor finito e ≥ 0.

## Agregações financeiras

### `totalRevenue(appts, patientsById)` — Faturado

Soma de `effectiveValue` de todas as sessões com `paid === true`.

### `pendingRevenue(appts, patientsById, today)` — Pendente

Soma de:
- Atendidas **não pagas** → `effectiveValue`.
- `scheduled` com `date < today` → `consultationValue` do paciente (expectativa de receita).

### Estimado (no dashboard)

Calculado em `dashboard.tsx` materializando as ocorrências do mês por paciente
(`occurrencesForPatient`) e somando, para cada ocorrência:
- com override `missed`/`cancelled` → ignora;
- com override → `effectiveValue`;
- sem override (virtual) → `consultationValue`.

Representa o **potencial de faturamento do mês** se tudo for atendido.

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
