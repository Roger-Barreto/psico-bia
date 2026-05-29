# Progresso da migração

> Marque `[x]` conforme conclui. Atualize a coluna **Status** e a data.
> Legenda: ✅ feito · 🟡 em andamento · ⬜ não iniciado.
> Detalhes de cada fase em [`passo-a-passo.md`](passo-a-passo.md).

**Início:** 2026-05-29 · **Última atualização:** 2026-05-29

---

## Visão geral

| Fase | Descrição | Quem | Status |
|---|---|---|---|
| 0 | Pré-requisitos (e-mail, GitHub) | VOCÊ | ⬜ |
| 1 | Criar conta + projeto Supabase, pegar chaves | VOCÊ | ⬜ |
| 2 | Configurar Auth (signup off, criar usuário) | VOCÊ | ⬜ |
| 3 | Schema do banco (tabelas) | VOCÊ (SQL pronto) | ⬜ |
| 4 | RLS + políticas | VOCÊ (SQL pronto) | ⬜ |
| 5 | RPCs (discharge, bulk-delete, scrub) | VOCÊ (SQL) / refinar no código | ⬜ |
| 6 | Storage (bucket privado + política) | VOCÊ (SQL pronto) | ⬜ |
| 7 | Código frontend (supabase-js, auth, queries) | CÓDIGO | ⬜ |
| 8 | Migrar dados existentes | CÓDIGO + VOCÊ | ⬜ |
| 9 | Deploy (Cloudflare Pages / Vercel) | VOCÊ | ⬜ |
| 10 | Checklist de segurança | JUNTOS | ⬜ |

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

- _(vazio)_
