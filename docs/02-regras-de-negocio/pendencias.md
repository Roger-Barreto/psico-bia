# Pendências e Checklist

Implementado em [`src/domain/pendencies.ts`](../../src/domain/pendencies.ts). Define o que conta como
"pendência" (ação que o psicólogo precisa tomar) e como o checklist de cada sessão é montado.

## Definição de pendência

Uma **pendência** é uma ação pendente do profissional. Sessões **atendidas mas não pagas** **não**
são pendências — são tratadas como alerta financeiro à parte (ver final deste doc e
[financeiro](financeiro.md)).

## `pendencyCount(occ, sharedItems, individualItems, today?)`

Retorna o número de pendências de **uma ocorrência**:

```
1. Se occ.date > today  → 0   (sessões futuras nunca pendem)
2. Se há override com status "cancelled" ou "rescheduled" → 0
3. Contagem de checklist:
   - Se status ∈ {attended, missed}:
       count += (snapshotItemIds \ checkedItemIds).length   // itens não cumpridos do snapshot
   - Senão (virtual ou scheduled):
       count += (compartilhados ativos) + (individuais ativos do paciente)
4. Sessão "scheduled" vencida:
   - Se occ.date < today E (sem override OU status === scheduled):
       count += 1   // precisa confirmar atendido/falta
```

### Interpretação por estado

| Estado da ocorrência | Pendências contadas |
|---|---|
| Futura (`date > hoje`) | 0 |
| Cancelada / reagendada | 0 |
| Atendida | itens do snapshot ainda não marcados |
| Falta | itens do snapshot ainda não marcados (a falta não isenta o checklist) |
| Scheduled/virtual com data passada | **todos** os itens do checklist vigente **+1** (confirmar presença) |
| Scheduled/virtual no dia de hoje | todos os itens do checklist vigente (sem o +1 de vencida) |

## `checklistFor(occ, sharedItems, individualItems): ChecklistEntry[]`

Monta a lista exibida no drawer. Cada entrada: `{ id, label, checked, source: "shared"|"individual" }`.

- Se a sessão está **fechada** (attended/missed), usa `snapshotItemIds` (ordem do snapshot).
- Senão, usa os itens **ativos**: compartilhados não arquivados + individuais não arquivados do
  paciente.
- `checked` vem de `appointment.checkedItemIds`.
- Se um ID do snapshot não existe mais no mapa de itens (foi removido), o label vira `"(item
  removido)"` — o histórico não quebra.

## `buildSnapshotIds(patientId, sharedItems, individualItems): string[]`

Produz o snapshot no momento do fechamento: IDs dos compartilhados ativos + individuais ativos do
paciente. Chamado por `markAttended` / `markMissed` no drawer.

## `pendencyIndex(occurrences, shared, individual, today?)`

Agrega por data ISO: `Map<isoDate, { count, pendencies }>` onde `count` = nº de ocorrências no dia e
`pendencies` = soma das pendências. Usado para **colorir o mini-calendário** (badge de pacientes +
ícone de aviso).

## Não pagos (alerta financeiro separado)

- `isUnpaidAttended(occ)`: `true` se a ocorrência é `attended` e `paid === false`.
- `unpaidIndex(occurrences, valueFor)`: agrega por data ISO → `Map<isoDate, { count, value }>`,
  somando o valor financeiro (`valueFor(occ)`, normalmente `effectiveValue`). Usado para o ícone
  `$` no mini-calendário e o badge "não pago" nos cards.

## Onde aparece na UI

- **Mini-calendário** ([`mini-calendar.tsx`](../../src/components/calendar/mini-calendar.tsx)):
  badge âmbar com nº de pacientes; ícone vermelho de aviso se `pendencies > 0`; ícone `$` âmbar se
  `unpaid > 0`; fundo `destructive/15` (pendência) ou `amber/15` (só não-pago).
- **Lista do dia** (Agenda): cor do card e badge de status conforme pendência/pagamento.
- **Drawer de atendimento:** pílula de status mostra "N pendências" e/ou "não pago"; o checklist
  mostra `marcados / total` e avisa "Itens não marcados contam como pendência no painel".
- **Dashboard:** o bloco de pendências (totais: total / vencidas / hoje) e a lista por paciente
  recalculam a contagem item-a-item diretamente sobre os `Appointment` do mês (lógica equivalente
  espelhada em `dashboard.tsx::countPendencyItems`).

> Nota: o dashboard reimplementa a contagem de pendências sobre `Appointment[]` (sem materializar
> `Occurrence`) por performance, mas segue exatamente a mesma regra de `pendencyCount`.
