# Recorrência — Geração de Ocorrências

Implementado em [`src/domain/recurrence.ts`](../../src/domain/recurrence.ts), apoiado por
[`src/domain/dates.ts`](../../src/domain/dates.ts). Funções **puras** (sem I/O): recebem séries +
intervalo + overrides e retornam ocorrências.

## Princípio: lazy, por intervalo

A recorrência futura **nunca é materializada** em disco. As ocorrências são calculadas sob demanda
para o **intervalo visível** (geralmente o mês do mini-calendário ou do dashboard). Isso mantém o
`appointments.json` pequeno (só guarda estados reais) e o uso de memória baixo.

## Funções principais

### `occurrencesForSeries(series, range, overrides): Occurrence[]`

Calcula as ocorrências de **uma série** dentro de `[range.fromISO, range.toISO]` (inclusive).

Passos:

1. **Limite superior efetivo** (`seriesEnd`): o menor entre `series.endDate` (se houver) e
   `range.toISO`.
2. Se o intervalo começa depois do fim da série, retorna apenas reagendamentos que caíram **dentro**
   do intervalo vindos de origens fora dele (ver `collectOutOfRangeReschedules`).
3. **Gera as datas de origem** (`generateOriginDates`) entre `max(range.from, startDate)` e
   `seriesEnd`.
4. Indexa os overrides por `originDate`.
5. Para cada data de origem:
   - Se há override `cancelled` → **pula** (não emite ocorrência).
   - Se há override `rescheduled` cujo destino caiu **fora** do intervalo → pula (será reincluído na
     view do intervalo de destino).
   - Caso contrário emite a ocorrência, usando `rescheduledTo` como `date` quando reagendado, e o
     `time`/`appointment` do override.
   - Sem override → ocorrência "virtual" com `date = originDate` e `time = series.time`.
6. Acrescenta reagendamentos cujo **destino** caiu dentro do intervalo mas cuja origem está fora
   (`collectOutOfRangeReschedules`), evitando duplicatas via `Set` de origens já emitidas.

### `occurrencesForPatient(patient, series, range, overrides): Occurrence[]`

Agrega as ocorrências de **todas as séries** de um paciente, aplicando o **cap de encerramento**:

- Se `patient.active === false` → retorna vazio.
- Se `patient.dischargedAt` é anterior a `range.toISO` → o intervalo é truncado em `dischargedAt`
  (não gera ocorrências após a alta).
- Filtra os overrides por série antes de delegar a `occurrencesForSeries`.

## `generateOriginDates(series, rangeStart, rangeEnd)`

Gera as datas-âncora conforme a frequência:

| Frequência | Regra |
|---|---|
| `null` (único) | Uma única data = `startDate`, se cair no intervalo. |
| `weekly` | Passo de **7 dias** a partir de `startDate`. Avança o cursor para dentro do intervalo via `ceil(diff/7)` saltos antes de iterar. |
| `biweekly` | Idêntico, passo de **14 dias**. |
| `monthly` | Mesmo **dia-do-mês** de `startDate`. Para cada mês, `dia = min(diaAncora, últimoDiaDoMês)` — daí o fallback automático para fim de mês (ex.: 31 → 30/28). |

Em todos os casos só emite datas `>= startDate` e dentro de `[rangeStart, rangeEnd]`.

## Utilidades de data (`dates.ts`)

Todas operam em **horário local** (não UTC) para evitar deslocamento de dia, exceto `diffDays` que
normaliza via `Date.UTC` para contar dias corridos com segurança.

| Função | Uso |
|---|---|
| `toISO(d)` / `fromISO(s)` | Converte `Date` ↔ string `YYYY-MM-DD` (local). |
| `todayISO()` | Hoje em ISO local. |
| `startOfMonth` / `endOfMonth` | Limites do mês. |
| `addDays(d, n)` | Soma dias. |
| `diffDays(a, b)` | Dias corridos entre datas (via UTC). |
| `monthMatrix(d)` | Matriz 7×6 (42 células) do mês visível, começando no domingo. |
| `sameDay(a, b)` | Comparação de dia. |
| `formatDateBR` | `YYYY-MM-DD` → `DD/MM/YYYY`. |
| `formatLongDateBR` | `YYYY-MM-DD` → `"Sexta, 22 de maio"`. |
| `formatDateTimeBR` | ISO date **ou** datetime → string localizada pt-BR. |

## Exemplos

- **Semanal** começando 2026-01-13 (terça), vendo janeiro/2026 → 13, 20, 27 (e 06 se dentro do
  intervalo e ≥ start).
- **Quinzenal** começando 2026-01-13 → 13/01, 27/01, 10/02, ...
- **Mensal** começando 2026-01-31 → 31/01, 28/02, 31/03, 30/04, ...
- **Reagendamento:** sessão de 20/01 movida para 25/01 → some de 20/01, aparece em 25/01. Se eu
  visualizar só a semana de 25/01, ela aparece mesmo sendo originada em 20/01 (via
  `collectOutOfRangeReschedules`).

## Invariantes garantidas

- Nenhuma ocorrência é emitida após `endDate` da série ou após `dischargedAt` do paciente.
- Cada `(seriesId, originDate)` aparece no máximo uma vez por view.
- Reagendamentos não duplicam: a origem é marcada como emitida.
- Cancelamentos somem completamente da view.
