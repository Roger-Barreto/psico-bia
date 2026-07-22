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

Um lançamento recorrente **aparece todo mês até a recorrência ser cancelada**. Ações na UI
(lista de lançamentos e fatura do cartão — migration `025`):

- **Cancelar recorrência** (menu da linha) → `delete_recurring(scope='future')`: remove os
  lançamentos **não quitados daquele mês em diante** e desativa a regra; quitados e meses
  anteriores ficam como histórico.
- **Excluir** numa linha recorrente abre duas opções:
  - **Excluir somente este** → `scope='one'`: apaga só aquele mês **e grava um tombstone** em
    `finance_recurring_skips (rule_id, period)` — a materialização pula esse mês e a linha
    **não volta mais** (era o bug: o delete simples era recriado no próximo acesso).
  - **Excluir e cancelar recorrência** → `scope='one_and_future'`: apaga o mês clicado (mesmo
    quitado) + futuros não quitados e desativa a regra.
- `scope='all'` (sem UI hoje) apaga não quitados de todos os meses e remove a regra.

Edições (`edit_recurring`) atingem só linhas **não quitadas** (as quitadas são histórico).

**Repetir N vezes** (recorrência limitada, migration `027`): coluna `finance_recurring_rules.occurrences`
(null = infinito). No diálogo de lançamento, o modo *Recorrente* oferece **Sempre** ou **Repetir Nº de
vezes**; a materialização para depois de N meses a partir do início. Vale para despesa, receita, cartão
e empréstimo (a regra já carrega `card_id`/`person_id`). Para o cofrinho, ver *Cofrinhos → programar*.

**Horizonte de materialização** (correção do "recorrente no cartão some após 2 meses"): a competência é
materializada até **hoje + 3 meses** (`materializeUntilPeriod()` em `FinanceLayout`), e a página de
cartões materializa até o mês da fatura visualizada. Sem isso, faturas futuras (que caem 1–2 meses
**depois** da competência) ficavam vazias por falta das linhas que as alimentam.

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

**Pessoa recebedora (não empréstimo):** qualquer lançamento pode marcar uma **pessoa** como
recebedor/beneficiário mesmo com forma **não** empréstimo (campo *Pessoa (opcional)* no diálogo; o
trigger só exige pessoa para empréstimos, não a proíbe nos demais). Esses lançamentos aparecem na
página da pessoa (extrato) **e contam nos saldos/indicadores** como qualquer outro.

**Extrato da pessoa** (aba Pessoas): lista **todas** as movimentações com a pessoa (empréstimos +
recebedor). Indicadores do mês: **Recebido** e **Pago** (esperado = tudo, efetivo = quitados) +
**saldo em aberto** = `(a receber) − (a pagar)` contando **todo lançamento não quitado** ligado à
pessoa (não só empréstimos — igual à flag "ocultar pessoas zeradas" e à visão "Todas as pessoas").
Quitar parcelas reduz o saldo. O gráfico "Empréstimos por mês" segue só com empréstimos.

## Flags pago/recebido

Default do manual: já pago/recebido se a data ≤ hoje (ajustável); parcelas e recorrências nascem
não quitadas; a-receber de empréstimo nasce não quitado. `settledAt` guarda o momento.

## Indicadores da tela de Lançamentos

Seis indicadores: **Entradas**, **Saídas**, **Guardado**, **Retirado do cofrinho**,
**Saldo do mês**, **Acumulado desde jan.** Um seletor **Efetivo | Esperado** acima do quadro
alterna a visão de todos ao mesmo tempo (um único valor grande e colorido por indicador):

- **Efetivo** (padrão): só o que foi **efetivamente** marcado — recebido, pago, guardado.
- **Esperado**: considera **tudo** do mês — inclusive o que ainda não foi marcado como
  pago/recebido/guardado (a receber, a pagar, faturas em aberto, "a guardar" dos cofrinhos
  pendente).

Regras por indicador:

- **Compras no cartão não são saída do mês da compra**: ficam fora de Entradas/Saídas/Saldo e
  **fora da lista "Todos"** — no mês só aparece a **fatura** (linha sintética no vencimento,
  que conta como uma única saída, paga ou a pagar). As compras uma a uma ficam na visão
  "Compras no cartão" e na página do cartão.
- **Pagamentos com cofrinho** (`cofrinho_id`) saem da **reserva**, não do caixa: ficam fora de
  **Saídas** e do saldo; contam no indicador **"Retirado do cofrinho"** (estornos abatem;
  esperado = todos, efetivo = quitados). Nos **agrupadores por dia** da lista eles não entram no
  subtotal — quando houver, aparece abaixo, em letras miúdas, "retirado dos cofrinhos: X". Na
  linha do lançamento, o valor fica **âmbar** (não rosa) com a nota "retirado dos cofrinhos".
- **Guardado** = quanto foi movido para os cofrinhos no mês = `Σ depósitos − Σ retiradas` das
  atividades do cofrinho, **excluindo transferências** entre cofrinhos (neutras) e **sem** contar
  compras "pagar com cofrinho" (essas viram "Retirado do cofrinho"). Esperado soma o
  **"a guardar"** pendente do mês.
- **Saldo do mês** e **Acumulado** subtraem o guardado (ele conta como **saída** de caixa
  disponível): `entradas − saídas − guardado`. Retirar de um cofrinho volta como entrada.
  No esperado, o guardado inclui os lembretes pendentes (no acumulado, de jan. até o mês visto).

O quadro de indicadores dos cofrinhos foi removido; o botão **"Guardar no cofrinho"** (abre o
diálogo Movimentar) fica no topo da página, ao lado de "Novo lançamento".

## Cofrinhos (reservas)

`finance_cofrinhos` + `finance_cofrinho_entries` (migrations `022`–`024`, `026`). Tipos de meta
(`goal_type`):

| Tipo | Comportamento |
|---|---|
| `none` (Livre) | Sem meta, sem valor predefinido e sem lembretes; guarda quando quiser. |
| `target` (Objetivo) | Juntar um **valor total fixo** (`target_amount`), ex.: R$ 2.000 p/ viagem. Aporte mensal **opcional** (`fixed_amount`/`fixed_day`) gera lembretes até a meta ser atingida (último lembrete limitado ao que falta). O guardado **pode passar da meta**; a meta permanece fixa. Barra de progresso saldo/objetivo. |
| `fixed` (Mensal) | Valor fixo todo mês, sem data para acabar. |
| `percent` (% receita) | A cada recebimento, % vira meta de guardar no dia (base: toda receita ou só clínica). |

Saldo = inicial + depósitos − retiradas. Slots esperados são computados no client
(`src/domain/cofrinhos.ts`); só resoluções (guardar/pular) e planos (reposição/rollover/programado)
são persistidos.

**Controles (migration `027`)** — o usuário organiza como quiser:

- **Movimentar** (diálogo Guardar/Retirar): *Guardar* deposita (imediato, ou abatendo a meta do mês);
  *Retirar* tira da reserva de volta para o caixa (kind `withdraw`, neutro ao ledger). Retiradas e
  transferências reduzem o saldo (`entriesNet` = depósitos − withdraws).
- **Transferir entre cofrinhos**: 2 entries ligadas por um `parent_id` de transferência — um
  `withdraw` na origem + um `deposit` na destino (source `transfer`). Neutro ao total reservado;
  não conta como "guardado no mês".
- **Programar** (repetir N meses): *Guardar → repetir* grava N planos mensais (kind `plan`,
  source `repeat`) que aparecem como lembretes de guardar até serem resolvidos.
- **Pausar / Retomar** (`finance_cofrinhos.paused`): um cofrinho pausado **não gera lembretes
  automáticos** (fixo/percent/objetivo), mas mantém saldo, histórico e planos gravados. Retomar
  volta a gerar.

Novos valores: `finance_cofrinho_entries.kind` += `withdraw`; `source` += `transfer`, `repeat`.

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
