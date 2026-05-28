# Estado e Dados (TanStack Query)

Toda comunicação com a API passa por hooks em [`src/api/queries.ts`](../../src/api/queries.ts), sobre
o wrapper [`src/api/client.ts`](../../src/api/client.ts).

## Cliente HTTP — `client.ts`

`api` expõe `get/post/patch/delete/upload`. Detalhes:
- `get(path, params?)` monta querystring ignorando `undefined`.
- Sempre envia `Content-Type: application/json; charset=utf-8` (exceto `upload`, que usa `FormData`).
- Em `!res.ok`, lança `Error` com `.detail` (corpo JSON do erro, se houver).

## Query keys — `qk`

```ts
qk.patients              = ["patients"]
qk.shared                = ["shared-checklist"]
qk.individual(pid?)      = ["individual-checklist", pid ?? "all"]
qk.appointments(from,to) = ["appointments", from, to]
qk.series(pid?)          = ["series", pid ?? "all"]
qk.insurances            = ["insurances"]
qk.documents(pid)        = ["documents", pid]
qk.dischargeReasons      = ["discharge-reasons"]
qk.annotations(pid?)     = ["annotations", pid ?? "all"]
```

## Estratégia de cache

Defaults globais (`main.tsx`): `refetchOnWindowFocus: false`, `retry: 1`, `staleTime: 30s`,
`gcTime: 5min`. Ajustes por query:

| Hook | staleTime | Notas |
|---|---|---|
| `usePatients` | 30s | aceita `opts` (ex.: `enabled`). |
| `useAppointmentSeries` | 30s | filtro opcional por paciente. |
| `useSharedChecklist` | 60s | |
| `useIndividualChecklist` | 60s | |
| `useAppointmentsInRange` | 15s (gc 5min) | **chave por intervalo** → mês fora da view sai do cache. |
| `useInsurances` | 60s | |
| `usePatientDocuments` | 15s | `enabled: !!patientId`. |
| `useDischargeReasons` | 60s | |
| `usePatientAnnotations` | 30s | `enabled: !!patientId`. |

A chave por intervalo (`appointments`, `from`, `to`) é central para a estratégia "lazy por mês": cada
view busca só o seu intervalo; o GC descarta meses não visitados.

## Mutations e invalidação

Cada mutation invalida apenas as chaves afetadas. Exemplos notáveis:

| Mutation | Invalida |
|---|---|
| `useCreatePatient` / `useUpdatePatient` / `useArchivePatient` | `patients` |
| `useDischargePatient` | `patients`, `series`, `appointments` |
| `useDeletePatientPermanently` | `patients`, `series`, `appointments`, `annotations`, `individual-checklist` |
| `useCreate/Update/DeleteAppointmentSeries` | `series`, `appointments` |
| `useUpsertAppointment` / `usePatchAppointment` | `appointments` |
| `useUndoAppointment` | `appointments`, `series` |
| `useCreate/Update/ArchiveSharedItem` | `shared-checklist` |
| `useCreate/Update/ArchiveIndividualItem` | `individual-checklist` (e a chave específica do paciente) |
| `useCreate/Update/ArchiveInsurance` | `insurances` |
| `useCreate/Update/ArchiveDischargeReason` | `discharge-reasons` |
| `useUpload/DeleteDocument` | `documents(patientId)` |
| `useCreate/DeletePatientAnnotation` | `annotations` |

> Várias invalidações usam o **prefixo** (ex.: `["appointments"]` ou `["series"]`) para atingir todas
> as variações de intervalo/paciente de uma vez.

## Update otimista (checklist)

No `PatientDrawer.toggleItem`: antes do PATCH, percorre **todos** os caches de `["appointments"]` que
contêm o atendimento e atualiza `checkedItemIds` localmente; em erro, faz rollback restaurando os
snapshots capturados; ao final invalida `patients`. Resultado: o checkbox responde instantaneamente.

## Dados derivados no cliente

As páginas combinam os resultados das queries com a camada `domain/` (pura) via `useMemo`:
- Agenda: `occurrencesForPatient` + `pendencyCount` + `pendencyIndex`/`unpaidIndex`.
- Dashboard: contagens de pendência/financeiro diretamente sobre `Appointment[]` (sem materializar
  ocorrências, por performance) e `occurrencesForPatient` para o estimado.

Nada derivado é persistido nem cacheado pelo React Query — é recomputado por render (memoizado).
