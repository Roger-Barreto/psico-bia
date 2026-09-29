export type Gender = "male" | "female" | "other"
export type Frequency = "weekly" | "biweekly" | "monthly"
export type AppointmentStatus =
  | "scheduled"
  | "attended"
  | "missed"
  | "rescheduled"
  | "cancelled"

/** `individual`: uma pessoa · `couple`: terapia de casal (ver `members`). */
export type PatientKind = "individual" | "couple"

/**
 * Pessoa de um casal. Fica dentro do cadastro do casal (`patients.members`).
 * `patientId` liga a pessoa ao cadastro individual dela, quando ela também é
 * paciente sozinha — os outros campos são uma cópia, para o casal não perder
 * o nome se o cadastro individual for apagado.
 */
export interface CoupleMember {
  /** Estável: a presença nas sessões (`presentMemberIds`) aponta para ele. */
  id: string
  name: string
  gender: Gender | null
  birthdate: string | null // YYYY-MM-DD; opcional
  cpf: string | null // 11 dígitos; opcional
  avatarId: number
  patientId: string | null
}

export interface Patient {
  id: string
  /** Num casal, o nome do caso ("Ana & Bruno", "Casal Souza"). */
  name: string
  /** Num casal não significa nada (fica `other`); use `members`. */
  gender: Gender
  birthdate: string | null // YYYY-MM-DD; opcional (null = não informada)
  avatarId: number
  active: boolean
  createdAt: string
  consultationValue: number
  insuranceId: string | null
  individualChecklistItemIds: string[]
  dischargedAt: string | null
  dischargeReasonId: string | null
  cpf: string | null // dígitos do CPF do paciente (beneficiário)
  payerCpf: string | null // dígitos do CPF do pagador; null = mesmo que o paciente
  kind: PatientKind
  /** Pessoas do casal (2 a 4). Vazio em cadastro individual. */
  members: CoupleMember[]
}

export interface AppointmentSeries {
  id: string
  patientId: string
  startDate: string
  time: string
  frequency: Frequency | null
  endDate: string | null
  createdAt: string
}

export interface Insurance {
  id: string
  name: string
  active: boolean
  createdAt: string
  defaultValue: number
}

export interface DischargeReason {
  id: string
  name: string
  active: boolean
  createdAt: string
}

export interface PatientDocument {
  filename: string
  size: number
  modifiedAt: string
}

export interface SharedChecklistItem {
  id: string
  label: string
  order: number
  archived: boolean
}

export interface IndividualChecklistItem extends SharedChecklistItem {
  patientId: string
}

export interface Appointment {
  id: string
  seriesId: string
  patientId: string
  date: string
  originDate: string
  status: AppointmentStatus
  rescheduledTo: string | null
  time: string | null
  checkedItemIds: string[]
  snapshotItemIds: string[]
  notes: string | null
  updatedAt: string
  paid: boolean
  paidValue: number | null
  paidAt: string | null
  paymentMethodId: string | null
  /**
   * Falta que o contrato manda cobrar: a sessão continua gerando receita.
   * Só é relevante com `status === "missed"` — as demais transições zeram a
   * flag, e o banco recusa o contrário (constraint em 033_falta_cobrada.sql).
   */
  chargedAbsence: boolean
  /**
   * Pacote que pagou esta sessão. Quem preenche é o banco (trigger de
   * 034_pacotes_sessoes.sql) — e sempre junto com `paid = true` e
   * `paidValue = 0`: o dinheiro entrou na venda do pacote, não aqui.
   */
  packageId: string | null
  /**
   * Sessão de casal atendida: `members[].id` de quem veio. `null` = todos
   * (o comum). O banco limpa quando a sessão deixa de estar atendida.
   */
  presentMemberIds: string[] | null
}

/** Sessão que consumiu uma vaga de um pacote (recorte de `Appointment`). */
export interface PackageSession {
  appointmentId: string
  seriesId: string
  date: string
  originDate: string
  time: string | null
  status: AppointmentStatus
  chargedAbsence: boolean
}

/**
 * Pacote de sessões pré-pago: o paciente fecha N sessões por um valor
 * combinado e paga na hora. O saldo não é armazenado — sessões usadas são as
 * que apontam para o pacote (`sessions`).
 */
export interface SessionPackage {
  id: string
  patientId: string
  totalSessions: number
  totalValue: number
  paymentMethodId: string | null
  /** Dia da venda: competência da receita e primeiro dia coberto. */
  startDate: string
  paidAt: string | null
  notes: string | null
  /** Encerrado antes de acabar: o saldo que sobrou não será usado. */
  closedAt: string | null
  createdAt: string
  updatedAt: string
  /** Sessões já consumidas, da mais antiga para a mais recente. */
  sessions: PackageSession[]
}

export interface Occurrence {
  seriesId: string
  patientId: string
  originDate: string
  date: string
  time: string
  appointment: Appointment | null
  pendencyCount: number
}

export interface PatientAnnotation {
  id: string
  patientId: string
  text: string
  createdAt: string
}

// ════════════════════════════════════════════════════════════════
// Finance module
// ════════════════════════════════════════════════════════════════
export type TransactionKind = "income" | "expense"
export type FinanceScope = "clinic" | "personal"
export type LedgerSource = "manual" | "clinic"
/**
 * Edit/delete scope for recurring rules (mirrors appointment "undo" scopes).
 * `one` deletes a single month and tombstones it (never re-materialized);
 * `future` cancels the recurrence from a month on (settled rows stay);
 * `one_and_future` deletes the clicked month (even settled) + cancels.
 */
export type RecurringScope = "one" | "future" | "one_and_future" | "all"

export interface Person {
  id: string
  name: string
  notes: string | null
  avatarId: number
  active: boolean
  createdAt: string
}

export interface FinanceCategory {
  id: string
  name: string
  color: string | null
  active: boolean
  createdAt: string
}

export interface PaymentMethod {
  id: string
  name: string
  isLoan: boolean
  isCreditCard: boolean
  isCofrinho: boolean
  color: string | null
  active: boolean
  createdAt: string
}

/**
 * `percent` — save a % of each received income; `fixed` — fixed amount every
 * month, forever; `target` — reach a total amount (optionally with a monthly
 * saving until it's met); `none` — free reserve, no goal and no prompts.
 */
export type CofrinhoGoalType = "percent" | "fixed" | "target" | "none"
/** For percent goals: base the % on clinic revenue only, or on all income. */
export type CofrinhoIncomeScope = "clinic" | "all"

/**
 * Savings reserve. A cofrinho has a running balance (deposits − withdrawals)
 * and a goal: a % of received revenue, a fixed monthly amount, a total target
 * (the balance may exceed it; the target stays fixed), or no goal at all.
 */
export interface Cofrinho {
  id: string
  name: string
  color: string | null
  goalType: CofrinhoGoalType
  percent: number | null // 0..100 (goalType='percent')
  fixedAmount: number | null // valor mensal (goalType='fixed' | 'target' opcional)
  fixedDay: number | null // 1..31 (goalType='fixed' | 'target' opcional)
  incomeScope: CofrinhoIncomeScope // base da % (goalType='percent')
  targetAmount: number | null // objetivo total (goalType='target')
  initialAmount: number // saldo com que o cofrinho começa
  paused: boolean // pausado: não gera lembretes de guardar (mantém saldo)
  active: boolean
  createdAt: string
}

export type CofrinhoEntryKind = "deposit" | "skip" | "plan" | "withdraw"
export type CofrinhoEntrySource =
  | "fixed"
  | "percent"
  | "rollover"
  | "repay"
  | "manual"
  | "transfer"
  | "repeat"
export type CofrinhoEntryStatus =
  | "pending"
  | "saved"
  | "partial"
  | "skipped"
  | "done"

/**
 * A cofrinho movement. `deposit` = money saved in; `withdraw` = money taken out
 * of the reserve (to cash, or the outgoing side of a transfer); `skip` = a
 * dismissed goal slot; `plan` = a stored future obligation (replenishment of a
 * "pay with cofrinho", the leftover of a partial fixed goal, or a scheduled
 * repeat deposit). Expected slots for %/fixed goals are computed client-side.
 */
export interface CofrinhoEntry {
  id: string
  cofrinhoId: string
  kind: CofrinhoEntryKind
  date: string // YYYY-MM-DD
  period: string // YYYY-MM (generated)
  slotKey: string | null // fixed:YYYY-MM | pct:YYYY-MM-DD | plan:<id> | manual
  source: CofrinhoEntrySource
  expected: number | null // alvo do slot (planos)
  amount: number // depositado (0 p/ skip / plano pendente)
  status: CofrinhoEntryStatus
  purchaseTxId: string | null
  parentId: string | null
  description: string | null // livre, p/ depósitos avulsos aparecerem no ledger
  createdAt: string
  updatedAt: string
}

/**
 * Credit card registry. `closingDay`/`dueDay` drive which invoice a purchase
 * falls into; changing them only affects new purchases (past invoices keep the
 * dates stored on each transaction).
 */
export interface FinanceCard {
  id: string
  name: string
  closingDay: number // 1..31 — dia de fechamento da fatura
  dueDay: number // 1..31 — dia de vencimento da fatura
  color: string | null
  creditLimit: number | null
  brand: string | null
  last4: string | null
  active: boolean
  createdAt: string
}

export interface RecurringRule {
  id: string
  kind: TransactionKind
  scope: FinanceScope
  description: string
  amount: number
  categoryId: string | null
  paymentMethodId: string | null
  personId: string | null
  cardId: string | null
  dayOfMonth: number
  startPeriod: string // YYYY-MM
  occurrences: number | null // repetir N vezes (null = infinito)
  active: boolean
  createdAt: string
}

export interface Transaction {
  id: string
  kind: TransactionKind
  scope: FinanceScope
  description: string
  amount: number
  date: string // YYYY-MM-DD (competência)
  categoryId: string | null
  paymentMethodId: string | null
  personId: string | null
  cardId: string | null
  invoicePeriod: string | null // YYYY-MM (mês de vencimento da fatura)
  invoiceCloseDate: string | null // YYYY-MM-DD
  invoiceDueDate: string | null // YYYY-MM-DD
  cofrinhoId: string | null // reserva usada para pagar (retirada)
  settled: boolean
  settledAt: string | null
  recurringRuleId: string | null
  installmentGroup: string | null
  installmentNo: number | null
  installmentTotal: number | null
  linkId: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Unified ledger row: manual transactions + derived (read-only) clinic income.
 * Backed by the `finance_ledger` Postgres view.
 */
export interface LedgerEntry {
  id: string
  kind: TransactionKind
  scope: FinanceScope
  description: string
  amount: number
  date: string
  period: string // YYYY-MM
  categoryId: string | null
  categoryName: string | null
  paymentMethodId: string | null
  personId: string | null
  cardId: string | null
  invoicePeriod: string | null // YYYY-MM (mês de vencimento da fatura)
  invoiceCloseDate: string | null // YYYY-MM-DD
  invoiceDueDate: string | null // YYYY-MM-DD
  cofrinhoId: string | null // reserva usada para pagar (retirada)
  settled: boolean
  settledAt: string | null
  recurringRuleId: string | null
  installmentGroup: string | null
  installmentNo: number | null
  installmentTotal: number | null
  linkId: string | null
  source: LedgerSource
  editable: boolean
  patientId: string | null
}

// ════════════════════════════════════════════════════════════════
// Reading module (Leituras)
// ════════════════════════════════════════════════════════════════
export type BookStatus = "want" | "reading" | "finished" | "dnf" | "paused"
export type BookFormat = "physical" | "ebook" | "audiobook"

export interface Book {
  id: string
  title: string
  subtitle: string | null
  author: string | null
  coverUrl: string | null // URL externa OU pública do bucket
  coverPath: string | null // caminho no bucket (upload próprio)
  pageCount: number | null
  currentPage: number // fonte de verdade do progresso
  format: BookFormat
  genre: string | null
  publisher: string | null
  publishedYear: number | null
  isbn: string | null
  status: BookStatus
  rating: number | null // 0.5..5 (meia-estrela)
  review: string | null
  notes: string | null
  tags: string[]
  isFavorite: boolean
  color: string | null
  startedAt: string | null // YYYY-MM-DD
  finishedAt: string | null // YYYY-MM-DD
  rereadCount: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ReadingSession {
  id: string
  bookId: string
  date: string // YYYY-MM-DD
  startedAt: string | null
  endedAt: string | null
  durationSeconds: number
  startPage: number | null
  endPage: number | null
  pagesRead: number
  notes: string | null
  createdAt: string
}

export interface ReadingGoal {
  id: string
  year: number
  targetBooks: number | null
  targetPages: number | null
  targetMinutes: number | null
  createdAt: string
  updatedAt: string
}

export interface BookQuote {
  id: string
  bookId: string
  text: string
  page: number | null
  createdAt: string
}
