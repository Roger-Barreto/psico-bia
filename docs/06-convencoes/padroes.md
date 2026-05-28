# Padrões Arquiteturais (catálogo)

Padrões recorrentes e deliberados do projeto, com ponteiros para onde estão implementados.

## 1. Lazy occurrences (não materializar o futuro)

Recorrência calculada por intervalo, nunca gravada em massa. Só estados reais viram `Appointment`.
→ [recorrência](../02-regras-de-negocio/recorrencia.md), `domain/recurrence.ts`.

## 2. Snapshot de checklist (imutabilidade do passado)

Ao concluir uma sessão, congela-se `snapshotItemIds`. Edições futuras no checklist não alteram
sessões fechadas. → [pendências](../02-regras-de-negocio/pendencias.md), `buildSnapshotIds`.

## 3. Upsert por chave composta

`Appointment` é upsertado por `(seriesId, originDate)` — garante 1 override por ocorrência.
→ `POST /api/appointments` em `server/routes.ts`.

## 4. Soft-delete / arquivar

Pacientes (`active`), convênios/motivos (`active`), itens de checklist (`archived`) são **arquivados**,
não removidos. Exclusão permanente é uma rota separada e explícita.
→ [ciclo de vida](../02-regras-de-negocio/ciclo-de-vida-paciente.md).

## 5. Normalização defensiva (schema evolutivo sem migração)

Ao ler coleções, `normalize*` preenche campos novos ausentes em dados antigos. Sem versão de schema
nem migração destrutiva. → [backend](../03-arquitetura/backend.md#normalização-defensiva).

## 6. Escrita atômica + lock + backup

`update()` serializa por coleção (mutex em memória); `persist()` escreve em tmp e faz `rename`;
backup diário rotativo (7 dias). → `server/db.ts`.

## 7. Confirmação imperativa global

`confirmDialog(): Promise<boolean>` + host único. Sem prop drilling de estado de confirmação.
→ `ui/confirm-dialog.tsx`.

## 8. Update otimista com rollback

Toggle de checklist atualiza todos os caches de `appointments` e reverte em erro.
→ `PatientDrawer.toggleItem`, [estado e dados](../05-frontend/estado-e-dados.md#update-otimista-checklist).

## 9. Cache por intervalo + GC

`useAppointmentsInRange(from, to)` usa o intervalo como chave; meses fora da view são coletados pelo
GC do React Query. → [estado e dados](../05-frontend/estado-e-dados.md).

## 10. Domínio puro isolado

`domain/` não importa React nem faz I/O — funções puras testáveis, reaproveitadas por páginas e
(parcialmente) reespelhadas no dashboard. → `src/domain/`.

## 11. Dados derivados nunca persistidos

Idade, ocorrências, pendências, índices e agregações financeiras são sempre recalculados
(memoizados), nunca gravados. → [modelo de dados](../03-arquitetura/modelo-de-dados.md#dados-derivados-nunca-persistidos).

## 12. Feedback consistente

Toast em toda mutação; confete em marcos positivos/negativos; confirmação em ações destrutivas;
skeletons em carregamento. → [design system](../05-frontend/design-system.md#microinterações).

## 13. Defesa contra path traversal

Uploads/downloads de documentos resolvem o caminho com `safeResolveInside` (confina ao diretório do
paciente). → [segurança](../07-operacao/seguranca.md).
