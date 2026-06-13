# Gestão Financeira (PF + PJ)

Módulo separado (`/financeiro`) para organizar a vida financeira do profissional de forma
centralizada: receitas e despesas **pessoais (PF)** e **da clínica (PJ)** num único ledger.
Distinto do dashboard clínico (medidor faturado×estimado×pendente), que permanece.

Implementação: domínio puro em [`src/domain/finance.ts`](../../src/domain/finance.ts), dados em
[`src/api/queries.ts`](../../src/api/queries.ts) (seção *Finance module*), UI em
[`src/pages/finance.tsx`](../../src/pages/finance.tsx) + `src/components/finance/`.

## Conceitos

| Termo | Definição |
|---|---|
| **Lançamento** (`Transaction`) | Receita (`income`) ou despesa (`expense`) |
| **Escopo** (`scope`) | `clinic` (PJ) \| `personal` (PF) |
| **Competência** (`date`) | Data `YYYY-MM-DD` que define o **mês** do valor (`period = YYYY-MM`) |
| **Quitado** (`settled`) | Flag pago/recebido (+ `settledAt`) |
| **Categoria** | Rótulo do usuário p/ análise; compartilhada receita+despesa |
| **Forma de pagamento** | PIX, Dinheiro, Débito, Crédito, Boleto, Transferência, Empréstimo… |
| **Pessoa** | Contraparte de empréstimo |
| **Recorrência** | Template mensal infinito que gera lançamentos |
| **Parcelamento** | N lançamentos iguais em N meses |

## Ledger unificado (visão de leitura)

A view **`finance_ledger`** (`security_invoker=true`, respeita RLS por usuário) é a **UNION** de:

1. **`finance_transactions`** — lançamentos manuais (`source='manual'`, `editable=true`).
2. **`finance_clinic_income`** — **derivada de `appointments`** (read-only, `editable=false`):
   - Uma receita por sessão **`attended`** de paciente **ativo**.
   - Valor = `coalesce(paid_value, consultation_value)`.
   - `settled = paid`; sessão paga → **recebida**, atendida não-paga → **a receber**.
   - Forma de pagamento = `appointments.payment_method_id`; categoria fixa "Atendimentos".
   - Competência = `appointments.date`.
   - **O usuário não cria/edita/remove** faturamento clínico — ele reflete a agenda.

> Marcar uma sessão como paga agora **exige escolher a forma de pagamento**
> ([`payment-control.tsx`](../../src/components/patient/payment-control.tsx)); ela propaga
> automaticamente para a receita clínica no ledger.

## Competência

Campo único `date`. O mês é sempre o da data escolhida — **ignora ciclo de fatura do cartão**
(uma compra no crédito em 13/06 conta no mês 06). Coluna gerada `period = substr(date,1,7)`.

## Recorrência

`finance_recurring_rules` (template mensal, infinito até `active=false`) **+ materialização sob
demanda**: ao abrir/navegar até um mês, o RPC `ensure_recurring_materialized(p_until_period)` cria
as linhas faltantes (idempotente via `unique(recurring_rule_id, period)`). Cada mês é uma linha
própria, com flag de pago independente. Dia do mês com **fallback ao último dia** (31 → 28/29/30).

Editar/excluir com escopos **este / este e futuros / todos** (`edit_recurring`, `delete_recurring`).
Edições atingem só linhas **não quitadas** (as quitadas são histórico); exclusão "todos" preserva
quitadas (desvincula via FK).

## Parcelamento

N linhas com `installment_group` comum, `installment_no/total`. Valor `total/N` com a **última
parcela absorvendo a sobra** de centavos (soma exata). Competência da parcela _k_ = data inicial
`+ (k-1)` meses. Recorrência e parcelamento são mutuamente exclusivos.

## Empréstimos e pessoas

Forma de pagamento com `is_loan=true` **exige `person_id`** (trigger
`finance_require_person_for_loan`). Direção é derivada:

- **Despesa + empréstimo** → *eu devo* àquela pessoa (ex.: comprei parcelado no cartão de alguém —
  conta na categoria real **e** como dívida; mesma linha, dois ângulos).
- **Receita + empréstimo** → *a pessoa me deve* (a receber).
- **Emprestei / paguei por alguém** (caso 3b) → **2 lançamentos ligados por `link_id`**: a saída
  real de caixa (despesa, forma real) **+** o a-receber (receita, forma Empréstimo).

**Extrato da pessoa** (aba Pessoas): lista todas as movimentações + **saldo em aberto** =
`(me devem) − (eu devo)`, contando apenas **não quitados**. Quitar parcelas reduz o saldo.

## Flags pago/recebido

Default do manual: já pago/recebido se a data ≤ hoje (ajustável); parcelas e recorrências nascem
não quitadas; a-receber de empréstimo nasce não quitado. `settledAt` guarda o momento.

## Dashboard financeiro

Período selecionável (mês atual padrão; 3/6/12 meses). Gráficos: receitas×despesas por mês, fluxo de
caixa acumulado, despesas por categoria, despesas por forma de pagamento, clínica×pessoal, saldo por
pessoa (em aberto). KPIs: receitas, despesas, saldo, a receber, a pagar.

## Modelo de dados

Tabelas: `people`, `finance_categories`, `payment_methods`, `finance_recurring_rules`,
`finance_transactions`; coluna nova `appointments.payment_method_id`; views `finance_clinic_income`,
`finance_ledger`. RLS por `user_id = auth.uid()` em todas (espelha o padrão dos demais módulos).
Seed de categorias/formas por usuário no 1º uso via `seed_finance_defaults()`. Migrations
`012`–`016`. Ver [modelo de dados](../03-arquitetura/modelo-de-dados.md#finance).
