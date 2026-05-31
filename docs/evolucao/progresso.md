# Progresso da migração

> Marque `[x]` conforme conclui. Atualize a coluna **Status** e a data.
> Legenda: ✅ feito · 🟡 em andamento · ⬜ não iniciado.
> Detalhes de cada fase em [`passo-a-passo.md`](passo-a-passo.md).

**Início:** 2026-05-29 · **Última atualização:** 2026-05-30

---

## Visão geral

| Fase | Descrição | Quem | Status |
|---|---|---|---|
| 0 | Pré-requisitos (e-mail, GitHub) | VOCÊ | ✅ |
| 1 | Criar conta + projeto Supabase, pegar chaves | VOCÊ | ✅ |
| 2 | Configurar Auth (signup off, criar usuário) | VOCÊ | ✅ |
| 3 | Schema do banco (tabelas) | MCP (001_initial_schema) | ✅ |
| 4 | RLS + políticas | MCP (002_rls_policies) | ✅ |
| 5 | RPCs (discharge, bulk-delete, scrub × 2) | MCP (003_rpcs) | ✅ |
| 6 | Storage (bucket privado + política) | MCP (004_storage_bucket_and_policy) | ✅ |
| 7 | Código frontend (supabase-js, auth, queries) | CÓDIGO | ✅ |
| 8 | Migrar dados existentes | CÓDIGO + VOCÊ | ✅ |
| 9 | Deploy (Vercel) | VOCÊ | ⬜ |
| 10 | Checklist de segurança | JUNTOS | 🟡 (pendente: HTTPS + teste incognito pós-deploy) |

---

## Detalhe por fase

### Fase 1 — Supabase
- [ ] Conta criada
- [ ] Projeto `psicobia` criado (região São Paulo)
- [ ] Database password guardada em local seguro
- [ ] `Project URL` anotada
- [ ] `anon public` key anotada

### Fase 2 — Auth
- [ ] Login por e-mail/senha habilitado
- [ ] **Cadastro público desabilitado**
- [ ] Conta única criada (Auto Confirm) com senha forte

### Fase 3 — Schema
- [ ] SQL das tabelas executado sem erro
- [ ] 9 tabelas visíveis em Table Editor

### Fase 4 — RLS
- [ ] RLS ativo nas 9 tabelas
- [ ] Política `authenticated` criada em cada uma

### Fase 5 — RPCs
- [ ] `discharge_patient` criada
- [ ] `bulk_delete_appointments` criada (escopo `one` refinado junto ao código)
- [ ] `scrub_checklist_item` criada

### Fase 6 — Storage
- [ ] Bucket `patient-documents` criado **privado**
- [ ] Política de Storage `authenticated` criada

### Fase 7 — Código
- [ ] `@supabase/supabase-js` instalado
- [ ] `src/lib/supabase.ts` criado
- [ ] `src/api/queries.ts` migrado para supabase-js / rpc
- [ ] `src/context/auth-context.tsx` + `login.tsx` em Supabase Auth
- [ ] Documentos via `supabase.storage`
- [ ] `useOpenPatientFolder` removido
- [ ] `.env.local` criado e no `.gitignore`
- [ ] (Pós-validação) `server/`, `vite-plugin-json-db.ts` removidos

### Fase 8 — Migração de dados
- [ ] Script escrito
- [ ] Tabelas populadas a partir de `data/*.json`
- [ ] Documentos enviados ao Storage
- [ ] Linha em `profile` criada

### Fase 9 — Deploy
- [ ] Repo no GitHub
- [ ] Projeto Pages/Vercel conectado
- [ ] Env vars configuradas no host
- [ ] Build OK, URL pública no ar
- [ ] Site URL + Redirect URLs configuradas no Supabase

### Fase 10 — Segurança (gate antes de produção)
- [ ] RLS ativo em todas as tabelas
- [ ] Bucket privado + política
- [ ] Signup desabilitado
- [ ] `service_role` key fora do frontend e do git
- [ ] `.env.local` no `.gitignore`
- [ ] HTTPS confirmado
- [ ] (Opcional) MFA habilitado
- [ ] Teste: URL pública sem login não carrega dados

---

## Notas e decisões durante a execução

> Anote aqui qualquer desvio do plano, erro encontrado, ou decisão tomada.

### 2026-05-30 — Execução automatizada via MCP Supabase

- **Project ref:** `yhnbqjscewaiwemlllwl` (psicobia, sa-east-1).
- **Auth user único:** `roger.barreto58@gmail.com` (UUID `8cd3b788-d806-48dd-a61f-a5a62e420c7f`).
- **Migrations aplicadas via MCP:**
  - `001_initial_schema` — 9 tabelas + 7 índices secundários (acrescentados para listagens por paciente/data).
  - `002_rls_policies` — RLS + policy `authenticated_*` para cada tabela.
  - `003_rpcs` — 4 RPCs: `discharge_patient`, `bulk_delete_appointments` (com `p_new_appointment_id` recebido do frontend), `scrub_shared_item`, `scrub_individual_item`. **Reconciliação com docs:** docs listavam 3 RPCs, mas `server/routes.ts` tinha 5 cascatas. Decisão: 4 RPCs + delete-paciente-permanente client-side (FK cascade + storage.remove).
  - `004_storage_bucket_and_policy` — bucket `patient-documents` privado + policy `authenticated`.
  - `005_lockdown_rls_auto_enable` — revoke EXECUTE de `public.rls_auto_enable()` (função do template Supabase, era warn no advisor).
- **Frontend rewrite:** `src/lib/supabase.ts` novo; `src/api/queries.ts` reescrito completamente com mappers snake_case ↔ camelCase; `src/context/auth-context.tsx` reescrito pra `supabase.auth`; `src/pages/login.tsx` username → email; `src/components/patient/patient-documents.tsx` perdeu botão "Abrir pasta" e usa signed URL no download; `src/components/profile/profile-drawer.tsx` adaptado pra `updateUser` async + `supabase.auth.updateUser({password})` pra troca de senha (com re-auth pra validar senha atual). `tsc -b` e `npm run build` passam clean.
- **Migração de dados** (`scripts/migrate-to-supabase.mjs`): roda com secret key local. 1 appointment órfão descartado (referenciava série inexistente). Final: 10 patients, 21 series, 33 appointments, 4 shared, 2 individual, 1 profile.
- **Pendente:** Fase 9 (deploy Vercel — manual via dashboard) + final do checklist (HTTPS confirmado + teste incognito + Site URL no Supabase Auth).
- **Pré-existentes ignoráveis:** `rls_policy_always_true` (by design para app de 1 usuário com signup off), `auth_leaked_password_protection` (HIBP opcional via dashboard).
