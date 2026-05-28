# Referência da API

Todos os endpoints vivem sob `/api/*`, servidos pelo middleware do Vite
([`server/routes.ts`](../../server/routes.ts)). Respostas são JSON com `Cache-Control: no-store`.
Erros de validação retornam `400 { error, details }`; recurso inexistente `404 { error: "not found" }`.

> **Sem autenticação por token.** Os endpoints não exigem credencial além do login inicial; a
> proteção é o roteamento client-side. Ver [segurança](../07-operacao/seguranca.md).

## Convenções

- Corpo de request: JSON (exceto upload de documento = `multipart/form-data`).
- Datas: `YYYY-MM-DD`; horários: `HH:MM`.
- "Arquivar" (DELETE) normalmente é **soft-delete** (`active`/`archived = ...`), não remoção.

---

## Autenticação / Perfil

| Método | Rota | Corpo | Resposta | Notas |
|---|---|---|---|---|
| POST | `/api/login` | `{ username, password }` | `SafeUser` | 401 se inválido. |
| GET | `/api/me` | — | `SafeUser` | Usuário atual. |
| PATCH | `/api/me` | `{ displayName?, avatarId? }` | `SafeUser` | Atualiza perfil. |
| POST | `/api/me/password` | `{ currentPassword, newPassword }` | `{ ok: true }` | 400 `current_password_invalid` se senha atual errada. Nova: 8–200 chars. |

## Pacientes

| Método | Rota | Corpo | Resposta | Notas |
|---|---|---|---|---|
| GET | `/api/patients` | — | `Patient[]` | Normalizado. |
| POST | `/api/patients` | `patientCreate` | `Patient` (201) | Avatar aleatório se omitido. |
| PATCH | `/api/patients/:id` | `patientPatch` | `Patient` | Renomeia pasta de docs se nome mudar. |
| DELETE | `/api/patients/:id` | — | `Patient` | Soft-delete (`active=false`). |
| POST | `/api/patients/:id/discharge` | `{ dischargedAt, dischargeReasonId }` | `{ patient, deletedAppointments }` | Encerra; corta séries; apaga futuros scheduled/rescheduled. |
| POST | `/api/patients/:id/reopen` | — | `Patient` | Reabre (zera alta). |
| DELETE | `/api/patients/:id/permanent` | — | `{ ok: true }` | **Hard delete** + cascata (séries, appts, anotações, checklist indiv., pasta docs). |

## Documentos do paciente

| Método | Rota | Corpo | Resposta | Notas |
|---|---|---|---|---|
| GET | `/api/patients/:id/documents` | — | `PatientDocument[]` | Lista (ignora dotfiles). |
| POST | `/api/patients/:id/documents` | `multipart/form-data` (campo `file`) | `PatientDocument` (201) | Upload via busboy; nome único em colisão. |
| GET | `/api/patients/:id/documents/:filename` | — | stream do arquivo | `Content-Disposition: attachment` (com `filename*` UTF-8). |
| DELETE | `/api/patients/:id/documents/:filename` | — | `{ ok: true }` | Remove o arquivo. |
| POST | `/api/patients/:id/open-folder` | — | `{ ok, path }` | Abre a pasta no explorador do SO (local). |

## Séries de atendimento

| Método | Rota | Corpo | Resposta | Notas |
|---|---|---|---|---|
| GET | `/api/appointment-series?patientId=` | — | `AppointmentSeries[]` | Filtro opcional por paciente. |
| POST | `/api/appointment-series` | `appointmentSeriesCreate` | `AppointmentSeries` (201) | Cria a série (gera ocorrências calculadas). |
| PATCH | `/api/appointment-series/:id` | `appointmentSeriesPatch` | `AppointmentSeries` | `patientId` não editável. |
| DELETE | `/api/appointment-series/:id` | — | `AppointmentSeries` | Remove a série **e** seus atendimentos. |

## Atendimentos

| Método | Rota | Corpo | Resposta | Notas |
|---|---|---|---|---|
| GET | `/api/appointments?from=&to=&patientId=` | — | `Appointment[]` | Filtra por intervalo de `date` e/ou paciente. |
| POST | `/api/appointments` | `appointmentUpsert` | `Appointment` | **Upsert** por `(seriesId, originDate)`. Merge parcial em update. |
| PATCH | `/api/appointments/:id` | `appointmentPatch` | `Appointment` | Atualiza status/checks/pagamento/notas; seta `updatedAt`. |
| DELETE | `/api/appointments/:id` | — | `Appointment` | Remove o override (volta a ocorrência virtual). |
| POST | `/api/appointments/bulk-delete` | `{ seriesId, scope, originDate? }` | `{ ok, removedCount, cancelledCount, seriesDeleted }` | "Desfazer" com escopo `one`/`future`/`all`. Ver [fluxos](../02-regras-de-negocio/fluxos.md#desfazer-atendimento-escopos). |

## Checklist compartilhado

| Método | Rota | Corpo | Resposta | Notas |
|---|---|---|---|---|
| GET | `/api/shared-checklist` | — | `SharedChecklistItem[]` | |
| POST | `/api/shared-checklist` | `checklistItemCreate` | item (201) | |
| PATCH | `/api/shared-checklist/:id` | `checklistItemPatch` | item | Edita label/order/archived. |
| DELETE | `/api/shared-checklist/:id` | — | item | Soft-archive (`archived=true`). |

## Checklist individual

| Método | Rota | Corpo | Resposta | Notas |
|---|---|---|---|---|
| GET | `/api/individual-checklist?patientId=` | — | `IndividualChecklistItem[]` | Filtro por paciente. |
| POST | `/api/individual-checklist` | `individualChecklistItemCreate` | item (201) | Inclui `patientId`. |
| PATCH | `/api/individual-checklist/:id` | `individualChecklistItemPatch` | item | |
| DELETE | `/api/individual-checklist/:id` | — | item | Soft-archive. |

## Convênios

| Método | Rota | Corpo | Resposta | Notas |
|---|---|---|---|---|
| GET | `/api/insurances` | — | `Insurance[]` | Normalizado (`defaultValue ?? 0`). |
| POST | `/api/insurances` | `insuranceCreate` | `Insurance` (201) | |
| PATCH | `/api/insurances/:id` | `insurancePatch` | `Insurance` | |
| DELETE | `/api/insurances/:id` | — | `Insurance` | Soft-archive (`active=false`). |

## Motivos de encerramento

| Método | Rota | Corpo | Resposta | Notas |
|---|---|---|---|---|
| GET | `/api/discharge-reasons` | — | `DischargeReason[]` | |
| POST | `/api/discharge-reasons` | `dischargeReasonCreate` | `DischargeReason` (201) | |
| PATCH | `/api/discharge-reasons/:id` | `dischargeReasonPatch` | `DischargeReason` | |
| DELETE | `/api/discharge-reasons/:id` | — | `DischargeReason` | Soft-archive. |

## Anotações

| Método | Rota | Corpo | Resposta | Notas |
|---|---|---|---|---|
| GET | `/api/patient-annotations?patientId=` | — | `PatientAnnotation[]` | Ordenado desc. por `createdAt`. |
| POST | `/api/patient-annotations` | `{ patientId, text }` | `PatientAnnotation` (201) | `text` 1–2000 chars. |
| DELETE | `/api/patient-annotations/:id` | — | `PatientAnnotation` | Remove. |

---

## Formato de erro

```json
// 400
{ "error": "invalid payload", "details": { /* Zod error.format() */ } }
// 404
{ "error": "not found" }
// 500
{ "error": "internal", "message": "..." }
// login inválido (401)
{ "error": "Credenciais inválidas" }
```

Os corpos esperados de cada rota estão detalhados em
[validação de schemas](validacao-schemas.md).
