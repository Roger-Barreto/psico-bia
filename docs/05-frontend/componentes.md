# Componentes

Inventário dos componentes não-primitivos (os primitivos `ui/` estão em
[design system](design-system.md)).

## Layout / navegação

| Componente | Arquivo | Papel |
|---|---|---|
| `AppShell` | `components/app-shell.tsx` | Sidebar + header + `<Outlet/>`. Menu de usuário, grupo "Cadastros" colapsável. |
| `ProtectedRoute` | `components/protected-route.tsx` | Redireciona p/ `/login` se sem usuário. |
| `Breadcrumbs` | `components/breadcrumbs.tsx` | Trilha de navegação no topo das páginas. |

## Paciente

| Componente | Arquivo | Papel |
|---|---|---|
| `PatientDrawer` | `patient/patient-drawer.tsx` | **Central de atendimento.** Cabeçalho com avatar editável, valor, convênio; data/status; ações (Atendido/Falta/Reagendar); mensagens contextuais; reagendamento; `PaymentControl`; checklist do dia (toggle otimista); anotações. Sub-sheets: editar cadastro, adicionar item de checklist, adicionar anotação, desfazer. |
| `PatientForm` | `patient/patient-form.tsx` | Cadastro/edição em abas (Dados, Checklist, Documentos). Seções: Identificação, Financeiro (convênio + valor com atalhos +110/+80), Tratamento (encerrar/reabrir/excluir). Valida nascimento quando preenchido (campo opcional). `CopyButton` ao lado dos CPFs. Prévia de futuros ao encerrar. |
| `PaymentControl` | `patient/payment-control.tsx` | Marcar/desmarcar pagamento, valor padrão ou customizado, forma de pagamento, confete. Aparece quando atendido **ou** em falta cobrada; o valor padrão vem de `effectiveValue` (respeita o valor já definido para a falta). |
| `SessionValueField` | `patient/session-value-field.tsx` | Seletor "usar valor diferente" + `parseAmount` + hook `useSessionValue`. Compartilhado pelo `PaymentControl` e pelo `MissedAppointmentDialog`. |
| `PatientDocuments` | `patient/patient-documents.tsx` | Upload (drag-drop/seleção, multi), ícone por tipo de arquivo, download, exclusão, "abrir pasta". |
| `PatientAvatar` | `patient/patient-avatar.tsx` | Avatar monstrinho + `genderLabel`. |
| `AvatarPicker` | `patient/avatar-picker.tsx` | Seleção de avatar (popover com os 56 monstrinhos). |
| `AddAnnotationDialog` | `patient/add-annotation-dialog.tsx` | Modal para nova anotação. |
| `AddChecklistItemDialog` | `patient/add-checklist-item-dialog.tsx` | Modal para novo item de checklist individual. |

## Agendamento

| Componente | Arquivo | Papel |
|---|---|---|
| `ScheduleAppointmentDialog` | `appointments/schedule-appointment-dialog.tsx` | Novo atendimento: combobox de paciente (busca acento-insensível, navegação por teclado), data/hora, único vs recorrente (frequência + data final). |
| `UndoAppointmentDialog` | `appointments/undo-appointment-dialog.tsx` | Desfazer com 3 escopos (este / este e futuros / todos), avisos por escopo, confirmação. |
| `MissedAppointmentDialog` | `appointments/missed-appointment-dialog.tsx` | Escolha ao marcar falta: **Não cobrar** (padrão) ou **Cobrar esta sessão** — esta abre um 2º passo com o valor a cobrar (`SessionValueField`). Cartões de opção grandes (alvo de toque). |

## Calendário

| Componente | Arquivo | Papel |
|---|---|---|
| `MiniCalendar` | `calendar/mini-calendar.tsx` | Grade 7×6 do mês. Badge âmbar com nº de pacientes; ícone vermelho (pendência); ícone `$` (não pago); **bolo rosa no canto superior esquerdo (aniversário)** com anel dourado e gradiente; ring no selecionado; borda no hoje. Exporta `monthRange`, `isToday`, `DayMeta`. |
| `BirthdayBanner` | `patient/birthday-banner.tsx` | Aniversariantes do dia, acima da lista da agenda. Gradiente rosa/dourado com brilho animado, avatar, "faz N anos hoje", horário da sessão do dia, chip "encerrado" e atalho para o cadastro. Dispara `celebrateBirthday()` quando o dia é hoje (uma vez por dia, via `sessionStorage`). |

## Dashboard

| Componente | Arquivo | Papel |
|---|---|---|
| `FinancialGauge` | `dashboard/financial-gauge.tsx` | Medidor meia-lua (Recharts RadialBar): estimado × faturado × pendente, % realizado, atalho para não-pagos. |
| `KpiCard` | `dashboard/kpi-card.tsx` | Cartão de indicador (label, valor, tom, hint). |
| `MonthSelector` | `dashboard/month-selector.tsx` | Navegação de mês/ano. |
| `PendencyBlock` | `dashboard/pendency-block.tsx` | Totais de pendências (total/vencidas/hoje). |
| `PendencyList` | `dashboard/pendency-list.tsx` | Lista de pacientes com pendências; tipo `PendencyBreakdown`. |
| `UnpaidPatientsDialog` | `dashboard/unpaid-patients-dialog.tsx` | Lista de pacientes não-pagos; tipo `UnpaidPatientEntry`. |
| `charts.tsx` | `dashboard/charts.tsx` | `ChartCard`, `RevenueByDayChart`, `CategoryPie`, `TopPatientsChart`, `MonthlyRevenueChart`. |
| `skeletons.tsx` | `dashboard/skeletons.tsx` | `DashboardSkeleton` (loading). |

## Perfil

| Componente | Arquivo | Papel |
|---|---|---|
| `ProfileDrawer` | `profile/profile-drawer.tsx` | Editar nome/avatar (`PATCH /api/me`) e trocar senha (`POST /api/me/password`), com validação de força/confirmação. |

## Confirmação imperativa

`confirmDialog(opts): Promise<boolean>` + `ConfirmDialogHost` (`ui/confirm-dialog.tsx`). Padrão de
"confirm assíncrono" sem estado local: chama-se `await confirmDialog({...})` em qualquer lugar; um
host global montado em `main.tsx` renderiza o modal e resolve a promessa. Suporta `destructive`,
labels customizados. Uma confirmação pendente é substituída se outra abrir (resolve a anterior como
`false`).

## Libs auxiliares

- `lib/utils.ts` — `cn(...)` (merge de classes Tailwind via clsx + tailwind-merge).
- `lib/monster-avatars.ts` — 56 avatares: `monsterAvatarSrc`, `randomMonsterAvatarId`,
  `monsterAvatarIds`, `stableMonsterAvatarId(seed)`.
- `lib/celebrate.ts` — `celebrate("happy"|"sad")`: confete com emojis temáticos.
- `lib/clipboard.ts` — `copyText(texto)`: `navigator.clipboard` com fallback `execCommand("copy")` (contexto não-seguro / WebKit antigo).
- `lib/cpf.ts` — `onlyDigits`, `formatCpf` (máscara progressiva), `isValidCpf`.
- `domain/age.ts` — `ageFromBirthdate` (→ `number | null`) e `ageLabel` (→ `"12 anos"` ou `null`).
- `domain/birthdays.ts` — `monthDay`, `ageOn`, `turningAgeLabel` e `birthdayIndex(patients, isoDates)`
  (mapa ISO → pacientes; ignora arquivados; 29/02 cai em 01/03 nos anos não bissextos).
