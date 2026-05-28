# Páginas

Telas roteadas em `src/pages/`. Todas (exceto login) ficam dentro do `AppShell`.

## `/login` — `login.tsx`

- Layout duas colunas: painel ilustrado (imagem + copy de marca) + formulário.
- Campos usuário/senha, toggle de visibilidade da senha, mensagem de erro inline.
- `login()` do `auth-context` → em sucesso navega para `/`.
- Pública (fora do `ProtectedRoute`).

## `/` — Dashboard — `dashboard.tsx`

A tela mais densa. Seletor de mês (`MonthSelector`) controla `year`/`month`. Transição animada entre
meses (framer-motion, direção conforme avanço/retrocesso).

Queries usadas: pacientes, séries, atendimentos do mês, atendimentos dos últimos 6 meses (faturamento
mensal), convênios, motivos, checklist compartilhado e individual.

Computações (memoizadas):
- **Pendências:** `countPendencyItems` por atendimento → totais (total/vencidas/hoje) e lista por
  paciente.
- **Não pagos:** agrega atendidos não pagos por paciente (valor via `effectiveValue`).
- **KPIs:** atendidos, faltas, em tratamento, encerrados (total + no mês), novos no mês, total de
  sessões.
- **Financeiro:** faturado (pagos), pendente (atendidos não pagos + scheduled vencidos), estimado
  (ocorrências do mês).
- **Gráficos:** faturamento por dia; pizza de status; top pacientes; faturamento 6 meses; pizzas de
  gênero/convênio/motivo de alta.

Componentes renderizados: `PendencyBlock`, `PendencyList`, `FinancialGauge`, `KpiCard`(×6),
`ChartCard` + gráficos, `PatientDrawer` (ao clicar numa pendência), `UnpaidPatientsDialog`.
Filtra fora pacientes arquivados. Mostra `DashboardSkeleton` enquanto carrega.

## `/agenda` — `home.tsx`

Gestão diária. Layout: mini-calendário (340px) + lista do dia.

- `MiniCalendar` colore os dias via `byDate` (índice de pendências + não-pagos do mês).
- Selecionar um dia filtra `dayOccurrences`; busca client-side por nome; ordena por horário e nome.
- Cada card mostra horário, avatar, nome, valor, idade·gênero·convênio, status e badges (pendência,
  não pago). Clicar abre o `PatientDrawer`.
- Botões: **Novo atendimento** (`ScheduleAppointmentDialog`) e **Novo paciente** (`Sheet` com
  `PatientForm`).
- As ocorrências do mês são calculadas com `occurrencesForPatient` + `pendencyCount`.

## `/patients` — `patients.tsx`

- Grid de cards de pacientes. Busca por nome; toggle "Mostrar arquivados".
- Contadores (ativos / arquivados).
- Clicar no card abre o `PatientForm` em `Sheet` (editar). Ícones de editar e arquivar (com
  confirmação) por card.
- Suporta deep-link `?edit=<id>` (abre o formulário daquele paciente).

## `/checklist` — `checklist.tsx`

- CRUD do checklist **compartilhado**. Input + "Adicionar" (Enter funciona).
- Lista ordenada por `order`; editar inline (Enter salva, Esc cancela); arquivar/restaurar.
- Toggle "Mostrar arquivados"; contadores.

## `/insurances` — `insurances.tsx`

- CRUD de **convênios**: nome + valor padrão (R$).
- Editar inline (nome e valor); arquivar/restaurar; toggle de arquivados.
- O valor padrão é exibido formatado; usado para sugerir o valor da consulta no cadastro do paciente.

## `/discharge-reasons` — `discharge-reasons.tsx`

- CRUD de **motivos de encerramento** (só nome). Mesma mecânica de inline edit + arquivar/restaurar.
- Alimenta o select de motivo na alta do paciente.

## Padrões comuns às páginas de cadastro

- `Breadcrumbs` no topo (ex.: Cadastros › Convênios).
- Badge com contagem de ativos + badge de arquivados.
- Soft-archive com botão de restaurar.
- Toasts em todas as operações.
