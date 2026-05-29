# Passo a passo — Migração para Supabase

> Guia completo, do zero. Siga na ordem. Cada fase tem um item correspondente em
> [`progresso.md`](progresso.md) — marque conforme conclui.
>
> Convenções: **[VOCÊ]** = ação manual sua (navegador/painel). **[CÓDIGO]** = mudança no
> repositório (eu faço quando você autorizar). **[JUNTOS]** = config local que combinamos.

---

## Fase 0 — Pré-requisitos

- [VOCÊ] Conta de e-mail.
- [VOCÊ] Conta no GitHub (recomendado — serve para logar no Supabase **e** na hospedagem).
- Node.js já instalado (o projeto já usa).

---

## Fase 1 — Criar conta e projeto no Supabase

### 1.1 Criar a conta
1. Acesse **https://supabase.com** e clique em **Start your project** (ou **Sign Up**).
2. Escolha **Continue with GitHub** (mais simples) ou e-mail/senha.
3. Autorize o acesso, se pedido.

### 1.2 Criar a organização
1. No primeiro acesso o Supabase pede para criar uma **Organization**.
2. Nome: ex. `inlive` ou seu nome. Plano: **Free**. Tipo: pessoal.

### 1.3 Criar o projeto
1. Clique em **New project**.
2. **Name:** `psicobia`.
3. **Database Password:** clique em **Generate a password** e **GUARDE em local seguro**
   (gerenciador de senhas). É a senha de admin do banco — você raramente vai usá-la, mas não dá para recuperar depois.
4. **Region:** escolha **South America (São Paulo)** — menor latência no Brasil.
5. **Plan:** Free.
6. Clique em **Create new project** e aguarde ~2 min (provisionamento).

### 1.4 Pegar as chaves de API
1. No projeto: menu lateral → **Project Settings** (ícone de engrenagem) → **API**.
2. Anote dois valores:
   - **Project URL** (algo como `https://xxxxxxxx.supabase.co`).
   - **anon public** key (uma chave longa — é segura para o frontend).
3. **NÃO** use a `service_role` key no frontend — ela ignora o RLS. Só guarde-a para o
   script de migração de dados (Fase 6), que roda na sua máquina.

> Guarde por enquanto num bloco de notas; na Fase 5 colocamos num `.env` local.

---

## Fase 2 — Configurar a autenticação (usuário único)

Como há **um só usuário** (o psicólogo), desabilitamos cadastro público e criamos a conta à mão.

### 2.1 Desabilitar cadastros públicos
1. Menu lateral → **Authentication** → **Sign In / Providers** (ou **Providers**).
2. Em **Email**, deixe habilitado o login por e-mail/senha.
3. Procure a opção **Allow new users to sign up** (fica em **Authentication → Sign In / Providers**,
   ou em **Authentication → Settings** dependendo da versão do painel) e **desligue**.
   Isso impede que estranhos criem conta.
4. (Opcional, recomendado para dado de saúde) Em **Authentication → Settings**, considere exigir
   confirmação de e-mail e, mais adiante, **MFA**.

### 2.2 Criar a sua conta manualmente
1. Menu lateral → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Informe seu **e-mail** e uma **senha forte**. Marque **Auto Confirm User** (para não depender de e-mail).
3. Esse será o login do app.

---

## Fase 3 — Criar o schema do banco (tabelas)

1. Menu lateral → **SQL Editor** → **New query**.
2. Cole o SQL abaixo e clique em **Run**.

> Nota de design: campos de data/hora ficam como `text` para **preservar exatamente** as strings
> ISO (`YYYY-MM-DD` e timestamps) que o frontend já compara lexicamente. Os `id` continuam `text`
> (mesmos ids `nanoid` atuais), o que torna a migração de dados trivial e mantém as FKs intactas.

```sql
-- ─── PROFILE (dados do usuário além do que o Auth guarda) ───
create table public.profile (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Administrador',
  avatar_id   int
);

-- ─── INSURANCES (convênios) ───
create table public.insurances (
  id            text primary key,
  name          text not null,
  active        boolean not null default true,
  default_value numeric not null default 0,
  created_at    text not null
);

-- ─── DISCHARGE REASONS (motivos de alta) ───
create table public.discharge_reasons (
  id         text primary key,
  name       text not null,
  active     boolean not null default true,
  created_at text not null
);

-- ─── PATIENTS ───
create table public.patients (
  id                            text primary key,
  name                          text not null,
  gender                        text not null check (gender in ('male','female','other')),
  birthdate                     text not null,
  avatar_id                     int not null,
  active                        boolean not null default true,
  created_at                    text not null,
  consultation_value            numeric not null default 0,
  insurance_id                  text references public.insurances(id) on delete set null,
  individual_checklist_item_ids text[] not null default '{}',
  discharged_at                 text,
  discharge_reason_id           text references public.discharge_reasons(id) on delete set null
);

-- ─── APPOINTMENT SERIES ───
create table public.appointment_series (
  id         text primary key,
  patient_id text not null references public.patients(id) on delete cascade,
  start_date text not null,
  time       text not null,
  frequency  text check (frequency in ('weekly','biweekly','monthly')),
  end_date   text,
  created_at text not null
);

-- ─── APPOINTMENTS ───
create table public.appointments (
  id                text primary key,
  series_id         text not null references public.appointment_series(id) on delete cascade,
  patient_id        text not null references public.patients(id) on delete cascade,
  date              text not null,
  origin_date       text not null,
  status            text not null check (status in ('scheduled','attended','missed','rescheduled','cancelled')),
  rescheduled_to    text,
  time              text,
  checked_item_ids  text[] not null default '{}',
  snapshot_item_ids text[] not null default '{}',
  notes             text,
  updated_at        text not null,
  paid              boolean not null default false,
  paid_value        numeric,
  paid_at           text,
  unique (series_id, origin_date)   -- habilita upsert por (série, data-origem)
);

-- ─── SHARED CHECKLIST ───
create table public.shared_checklist (
  id       text primary key,
  label    text not null,
  "order"  int not null,
  archived boolean not null default false
);

-- ─── INDIVIDUAL CHECKLIST ───
create table public.individual_checklist (
  id         text primary key,
  patient_id text not null references public.patients(id) on delete cascade,
  label      text not null,
  "order"    int not null,
  archived   boolean not null default false
);

-- ─── PATIENT ANNOTATIONS ───
create table public.patient_annotations (
  id         text primary key,
  patient_id text not null references public.patients(id) on delete cascade,
  text       text not null,
  created_at text not null
);
```

> A FK `on delete cascade` faz a exclusão permanente de paciente apagar séries, sessões,
> anotações e itens individuais automaticamente. Só os arquivos no Storage precisam ser
> apagados pelo cliente (Fase 7).

---

## Fase 4 — Segurança: ativar RLS e políticas

Sem isso, **qualquer um com a anon key lê tudo**. Cole e rode no **SQL Editor**:

```sql
-- Ativa RLS em todas as tabelas
alter table public.profile              enable row level security;
alter table public.insurances           enable row level security;
alter table public.discharge_reasons    enable row level security;
alter table public.patients             enable row level security;
alter table public.appointment_series   enable row level security;
alter table public.appointments         enable row level security;
alter table public.shared_checklist     enable row level security;
alter table public.individual_checklist enable row level security;
alter table public.patient_annotations  enable row level security;

-- Política única por tabela: só usuário autenticado pode tudo.
-- (App de 1 usuário → "authenticated" basta.)
do $$
declare t text;
begin
  foreach t in array array[
    'profile','insurances','discharge_reasons','patients','appointment_series',
    'appointments','shared_checklist','individual_checklist','patient_annotations'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_authenticated', t
    );
  end loop;
end $$;
```

> Modelo "authenticated = acesso total" é seguro aqui porque só existe **uma** conta e o
> cadastro está desabilitado. Se um dia houver mais terapeutas, troca-se para `owner_id = auth.uid()`.

---

## Fase 5 — RPCs (as 3 cascatas de mutação)

Cole e rode no **SQL Editor**. São funções atômicas chamadas via `supabase.rpc(...)`.

```sql
-- 1) ALTA do paciente
create or replace function public.discharge_patient(
  p_id text, p_discharged_at text, p_reason_id text
) returns int language plpgsql security invoker as $$
declare deleted_count int;
begin
  update public.patients
     set discharged_at = p_discharged_at, discharge_reason_id = p_reason_id
   where id = p_id;

  update public.appointment_series
     set end_date = p_discharged_at
   where patient_id = p_id
     and (end_date is null or end_date > p_discharged_at);

  with del as (
    delete from public.appointments
     where patient_id = p_id
       and date > p_discharged_at
       and status in ('scheduled','rescheduled')
    returning 1
  )
  select count(*) into deleted_count from del;

  return deleted_count;
end $$;

-- 2) DESFAZER agendamento em lote (escopo: 'one' | 'future' | 'all')
--    Espelha server/routes.ts → /api/appointments/bulk-delete.
--    (Versão a refinar na implementação; lógica conceitual abaixo.)
create or replace function public.bulk_delete_appointments(
  p_series_id text, p_scope text, p_origin_date text
) returns json language plpgsql security invoker as $$
declare
  v_freq text;
  v_start text;
  removed int := 0;
  cancelled int := 0;
  series_deleted boolean := false;
begin
  select frequency, start_date into v_freq, v_start
    from public.appointment_series where id = p_series_id;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_scope = 'all' or (p_scope = 'one' and v_freq is null) then
    delete from public.appointments where series_id = p_series_id;
    get diagnostics removed = row_count;
    delete from public.appointment_series where id = p_series_id;
    series_deleted := true;

  elsif p_scope = 'one' then
    -- cancela só a ocorrência daquela origem (upsert para 'cancelled')
    -- detalhe de implementação fica no código (precisa gerar id se não existir).
    cancelled := 1;

  else -- 'future'
    update public.appointment_series
       set end_date = (p_origin_date::date - 1)::text
     where id = p_series_id;
    delete from public.appointments
     where series_id = p_series_id and origin_date >= p_origin_date;
    get diagnostics removed = row_count;
  end if;

  return json_build_object(
    'ok', true, 'removedCount', removed,
    'cancelledCount', cancelled, 'seriesDeleted', series_deleted
  );
end $$;

-- 3) SCRUB de item de checklist (remoção permanente)
create or replace function public.scrub_checklist_item(p_item_id text)
returns void language plpgsql security invoker as $$
begin
  update public.appointments
     set checked_item_ids  = array_remove(checked_item_ids,  p_item_id),
         snapshot_item_ids = array_remove(snapshot_item_ids, p_item_id)
   where p_item_id = any(checked_item_ids)
      or p_item_id = any(snapshot_item_ids);

  -- item individual: tirar também do array do paciente
  update public.patients
     set individual_checklist_item_ids = array_remove(individual_checklist_item_ids, p_item_id)
   where p_item_id = any(individual_checklist_item_ids);
end $$;
```

> A RPC `bulk_delete_appointments` escopo `'one'` precisa de detalhe que é melhor finalizar
> junto com o código (gerar id de sessão nova quando não existe linha). Marcado para a fase de implementação.

---

## Fase 6 — Storage (documentos dos pacientes)

1. Menu lateral → **Storage** → **New bucket**.
2. **Name:** `patient-documents`. **Public bucket:** **DESMARCADO** (privado!).
3. Create.
4. Políticas do bucket (SQL Editor) — só autenticado acessa:

```sql
create policy "patient_docs_authenticated"
on storage.objects for all to authenticated
using (bucket_id = 'patient-documents')
with check (bucket_id = 'patient-documents');
```

> No app, os arquivos ficam no caminho `{patientId}/{nomeArquivo}`. Download via **signed URL**
> (link temporário). Isso elimina o rename de pasta na troca de nome do paciente e a migração de pastas antigas.

---

## Fase 7 — Mudanças no código (eu faço, quando autorizar)

Concentradas e de baixo risco — os componentes de UI não mudam:

1. `npm install @supabase/supabase-js`.
2. Criar `src/lib/supabase.ts` (cliente com URL + anon key via env).
3. Reescrever [`src/api/queries.ts`](../../src/api/queries.ts): trocar chamadas `api.*` por
   `supabase.from(...).select/insert/update/delete` e `supabase.rpc(...)`. Mesmos formatos de retorno → hooks/UI intactos.
4. Reescrever [`src/context/auth-context.tsx`](../../src/context/auth-context.tsx) para `supabase.auth`
   (sessão real). Ajustar [`src/pages/login.tsx`](../../src/pages/login.tsx).
5. Documentos: upload/download/delete via `supabase.storage`.
6. Remover `useOpenPatientFolder` e o botão de "abrir pasta".
7. (No fim, após validar) remover `server/`, `vite-plugin-json-db.ts` e ajustar `vite.config.ts`.

### Variáveis de ambiente (local)
Criar `.env.local` na raiz (e adicionar ao `.gitignore` — **nunca commitar**):

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

---

## Fase 8 — Migrar os dados atuais

Script one-time (roda na sua máquina, usa a `service_role` key para ignorar RLS na carga):

1. Lê `data/*.json` e insere nas tabelas (preservando os ids).
2. Sobe `data/patient-documents/**` para o bucket `patient-documents`.
3. Cria/atualiza a linha em `profile` com seu display name/avatar.

> Eu escrevo esse script na fase de implementação. A `service_role` key fica só num `.env`
> local do script, **nunca** no frontend nem no git.

---

## Fase 9 — Deploy (frontend estático, grátis)

Opção recomendada: **Cloudflare Pages** (ou **Vercel** — ambos grátis e com HTTPS automático).

### Cloudflare Pages
1. Suba o repositório para o **GitHub** (se ainda não estiver).
2. Acesse **https://dash.cloudflare.com** → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
3. Selecione o repositório.
4. Build settings:
   - **Framework preset:** Vite.
   - **Build command:** `npm run build`.
   - **Build output directory:** `dist`.
5. Em **Environment variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (os mesmos do `.env.local`).
6. **Save and Deploy**. Em ~1 min sai uma URL `https://psicobia.pages.dev`.

### Configurar URL no Supabase
1. **Authentication → URL Configuration**: adicione a URL do site em **Site URL** e em
   **Redirect URLs**. Necessário para o fluxo de login funcionar no domínio público.

---

## Fase 10 — Checklist de segurança (ANTES de usar em produção)

- [ ] RLS **ativo** em todas as 9 tabelas (Fase 4).
- [ ] Bucket `patient-documents` **privado** + política de Storage (Fase 6).
- [ ] **Cadastro público desabilitado** no Auth (Fase 2.1).
- [ ] Apenas **uma conta** criada, com **senha forte**.
- [ ] `service_role` key **nunca** no frontend nem no git (só no script de migração local).
- [ ] `.env.local` no `.gitignore`.
- [ ] Acesso sempre por **HTTPS** (automático no Cloudflare/Vercel).
- [ ] (Recomendado) **MFA** habilitado no Supabase Auth.
- [ ] Testar: abrir a URL pública **sem logar** → não deve carregar nenhum dado.

---

## Acesso nos dispositivos

Depois do deploy, é só abrir a URL (`https://psicobia.pages.dev`) no Safari do iPad/iPhone e no
Edge/Chrome do Windows e logar. No iPad/iPhone dá para **Adicionar à Tela de Início** (Safari →
Compartilhar → Adicionar à Tela de Início) e usar como se fosse um app.
