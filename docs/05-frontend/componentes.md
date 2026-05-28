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
| `PatientForm` | `patient/patient-form.tsx` | Cadastro/edição em abas (Dados, Checklist, Documentos). Seções: Identificação, Financeiro (convênio + valor com atalhos +110/+80), Tratamento (encerrar/reabrir/excluir). Valida nascimento. Prévia de futuros ao encerrar. |
| `PaymentControl` | `patient/payment-control.tsx` | Marcar/desmarcar pagamento, valor padrão ou customizado, confete. Só quando atendido. |
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

## Calendário

| Componente | Arquivo | Papel |
|---|---|---|
| `MiniCalendar` | `calendar/mini-calendar.tsx` | Grade 7×6 do mês. Badge âmbar com nº de pacientes; ícone vermelho (pendência); ícone `$` (não pago); ring no selecionado; borda no hoje. Exporta `monthRange`, `isToday`. |

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
