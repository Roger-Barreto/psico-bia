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
| `PatientForm` | `patient/patient-form.tsx` | Cadastro/edição em abas (Dados, Checklist, **Pacotes**, Documentos). Seletor **Individual \| Casal** — também na edição, para converter um cadastro no lugar. Seções: Identificação, Financeiro (convênio + valor com atalhos +110/+80), Tratamento (encerrar/reabrir/excluir). Valida nascimento quando preenchido (campo opcional). `CopyButton` ao lado dos CPFs. Prévia de futuros ao encerrar. |
| `PaymentControl` | `patient/payment-control.tsx` | Marcar/desmarcar pagamento. Três caminhos: **sessão avulsa** (valor padrão ou customizado + forma de pagamento), **novo pacote** (quantidade + valor total) e **descontar do pacote** (quando há saldo — já vem escolhido). Sessão paga por pacote mostra a posição (*sessão 2 de 4*) e *Tirar do pacote*. Aparece quando atendido **ou** em falta cobrada. |
| `PaymentMethodChips` | `patient/payment-method-chips.tsx` | Forma de pagamento como chips, com criação inline, estados de carregando/erro e a forma única já escolhida. Hook `usePaymentMethodChoice`. Usado pelo `PaymentControl` e pelo `PackageDialog`. |
| `UnarchivePatientDialog` | `patient/unarchive-patient-dialog.tsx` | Desarquivar paciente. Mostra os horários que voltam para a agenda e, se a recorrência gerou sessões sem registro enquanto ele esteve arquivado, pergunta se cancela ou mantém como pendentes. Usado na lista e na faixa "Paciente arquivado" do `PatientForm`. |
| `DischargeReasonField` | `patient/discharge-reason-field.tsx` | Motivo do encerramento como grupo de opções **inline** (linhas de 44px), com criação de motivo no lugar e sugestões de um toque para a conta que ainda não tem nenhum. |
| `PatientCombobox` | `patient/patient-combobox.tsx` | Busca de paciente com a lista na própria tela (acento-insensível, teclado). Acha casal pelo nome de qualquer pessoa e mostra o selo *Casal*. Usado em *Novo atendimento*, *Novo pacote* e para vincular pessoa de casal. |
| `ClientAvatar` / `patientSummary` | `patient/patient-avatar.tsx` | Avatar do cadastro — no casal, os das duas primeiras pessoas sobrepostos, no mesmo quadrado do individual. `patientSummary` monta a linha de resumo (*"34 anos · Feminino"* / *"Casal · Ana, 34 · Rafael"*). |
| `CoupleMembersField` | `patient/couple-members-field.tsx` | As pessoas do casal no cadastro: um cartão por pessoa (avatar, nome, gênero, nascimento, CPF), vínculo com cadastro individual, adicionar/remover (2 a 4). |
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
| `MissedAppointmentDialog` | `appointments/missed-appointment-dialog.tsx` | No casal, a opção **"Só parte do casal veio"** registra a sessão como atendida com a presença certa. Escolha ao marcar falta: **Não cobrar** (padrão) ou **Cobrar esta sessão** — esta abre um 2º passo com o valor a cobrar (`SessionValueField`). Quando o paciente tem pacote com saldo, a segunda opção vira **Descontar do pacote** e não há valor a escolher. Cartões de opção grandes (alvo de toque). |

## Pacotes de sessões

Regras em [pacotes de sessões](../16-pacotes-sessoes/README.md).

| Componente | Arquivo | Papel |
|---|---|---|
| `PackageFields` | `packages/package-fields.tsx` | Quantidade (− / +, atalhos 4/5/8/10) e valor total, com o preço por sessão e o desconto calculados na hora. Hook `usePackageFields`: o valor acompanha a quantidade até ser editado. |
| `PackageProgress` / `PackageStateBadge` | `packages/package-progress.tsx` | Barra de uso (uma casa por sessão até 12) sempre com o número por extenso; selo *Em andamento / Concluído / Encerrado*. |
| `PackageCard` | `packages/package-card.tsx` | Cartão de um pacote na lista. |
| `PackageDialog` | `packages/package-dialog.tsx` | Novo pacote fora de uma sessão, ou editar um existente. |
| `PackageDetailDialog` | `packages/package-detail-dialog.tsx` | Saldo, sessões usadas (data + atendida/falta cobrada) e ações: editar, encerrar/reabrir, excluir. |
| `PatientPackages` | `packages/patient-packages.tsx` | Pacotes de um paciente — aba *Pacotes* do cadastro. |

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

## Fechar drawers e diálogos

O X de `Sheet` e `Dialog` fica numa âncora `sticky` (acompanha a rolagem), abaixo da área segura
do iPhone, com 40px de alvo. Detalhes e a regra para quem cria um drawer novo em
[celular](../17-mobile/README.md#1-o-x-de-fechar).

## Libs auxiliares

- `domain/couples.ts` — terapia de casal: `isCouple`, `resolveMembers` (dados vivos do vínculo),
  `coupleAutoName`, `splitCoupleName` (converter contorno), `matchesPatient` (busca pelas pessoas),
  `couplesOfPatient`, `presentIds`/`toPresenceValue`/`presenceLabel`, `peopleGenders`.
- `domain/packages.ts` — pacotes de sessões: `packageUsed`/`packageRemaining`/`packageState`,
  `positionInPackage`, `packageForDate` (o pacote que o banco usaria), `openPackage`,
  `packageTotals`, `packagesSoldInRange`, `projectedCoverage`.

- `lib/utils.ts` — `cn(...)` (merge de classes Tailwind via clsx + tailwind-merge).
- `lib/monster-avatars.ts` — 56 avatares: `monsterAvatarSrc`, `randomMonsterAvatarId`,
  `monsterAvatarIds`, `stableMonsterAvatarId(seed)`.
- `lib/celebrate.ts` — `celebrate("happy"|"sad")`: confete com emojis temáticos.
- `lib/clipboard.ts` — `copyText(texto)`: `navigator.clipboard` com fallback `execCommand("copy")` (contexto não-seguro / WebKit antigo).
- `lib/cpf.ts` — `onlyDigits`, `formatCpf` (máscara progressiva), `isValidCpf`.
- `domain/age.ts` — `ageFromBirthdate` (→ `number | null`) e `ageLabel` (→ `"12 anos"` ou `null`).
- `domain/birthdays.ts` — `monthDay`, `ageOn`, `turningAgeLabel` e `birthdayIndex(patients, isoDates)`
  (mapa ISO → pacientes; ignora arquivados; 29/02 cai em 01/03 nos anos não bissextos).
