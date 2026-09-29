-- ============================================================
-- 035_casais.sql — terapia de casal
--
-- A psicóloga também atende casais, mas o cadastro só tinha pessoas. O
-- contorno encontrado nos dados: um "paciente" chamado "Fulana e Ciclano",
-- com gênero "Outro", sem data de nascimento (não cabem duas) e um único CPF.
--
-- Modelo: o casal é um PACIENTE do tipo `couple` — o caso clínico — com as
-- pessoas dentro dele (`members`). Agenda, séries, pagamentos, pacotes,
-- checklist, anotações, documentos, alta e financeiro já são pendurados em
-- `patient_id`, então tudo isso passa a valer para o casal sem mudar nada.
-- E um cadastro de contorno pode ser convertido no lugar, sem perder o
-- histórico.
--
-- `members` é jsonb (e não uma tabela filha) de propósito: grava junto com
-- o paciente, no mesmo update — não existe o estado "casal sem pessoas" que
-- duas escritas separadas permitiriam. A validação fica numa CHECK.
--
-- Cada pessoa:
--   { "id": "m_…", "name": "Ana", "gender": "female"|"male"|"other"|null,
--     "birthdate": "YYYY-MM-DD"|null, "cpf": "11 dígitos"|null,
--     "avatarId": 12, "patientId": "p_…"|null }
-- `patientId` liga a pessoa ao cadastro INDIVIDUAL dela, quando ela também é
-- paciente sozinha. Os outros campos ficam como cópia — se o cadastro
-- individual for apagado, o casal continua com o nome e os dados.
--
-- `appointments.present_member_ids`: numa sessão de casal atendida, quem
-- veio. `null` = todos (o comum). Só vale com status 'attended'.
--
-- ORDEM DE PUBLICAÇÃO: rode ANTES do frontend (que passa a ler e gravar as
-- colunas novas). A ordem inversa é segura: o app antigo não manda as colunas
-- e os defaults (`individual`, `[]`, `null`) são exatamente o de hoje.
--
-- Idempotente.
-- ============================================================

-- ── 1) Tipo do cadastro e pessoas do casal ───────────────────────────
alter table public.patients
  add column if not exists kind text not null default 'individual';

alter table public.patients
  drop constraint if exists patients_kind_check;
alter table public.patients
  add constraint patients_kind_check
  check (kind in ('individual', 'couple'));

alter table public.patients
  add column if not exists members jsonb not null default '[]'::jsonb;

comment on column public.patients.kind is
  '''individual'' ou ''couple''. No casal, quem é quem está em members.';
comment on column public.patients.members is
  'Pessoas do casal (2 a 4). Vazio em cadastro individual. Ver docs/18-casais.';

-- Validação das pessoas. `immutable` porque só olha os argumentos — é o que
-- permite usá-la numa CHECK.
create or replace function public.patient_members_valid(p_kind text, p_members jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_members is null or jsonb_typeof(p_members) <> 'array' then false
    when p_kind = 'individual' then jsonb_array_length(p_members) = 0
    when p_kind = 'couple' then
          jsonb_array_length(p_members) between 2 and 4
      and not exists (
            select 1
              from jsonb_array_elements(p_members) m
             where jsonb_typeof(m) <> 'object'
                or coalesce(btrim(m ->> 'id'), '') = ''
                or coalesce(btrim(m ->> 'name'), '') = ''
                or (m ->> 'cpf') !~ '^[0-9]{11}$'
                or (m ->> 'gender') not in ('male', 'female', 'other')
                or (m ->> 'birthdate') !~ '^\d{4}-\d{2}-\d{2}$'
                or (jsonb_typeof(m -> 'avatarId') is not null
                    and jsonb_typeof(m -> 'avatarId') <> 'number')
          )
      -- ids únicos: a presença nas sessões aponta para eles
      and (select count(distinct m ->> 'id') from jsonb_array_elements(p_members) m)
            = jsonb_array_length(p_members)
    else false
  end
$$;
-- Nota: com `->>` um campo ausente ou `null` vira SQL NULL, e `NULL !~ …` é
-- NULL — que o `or` trata como "não reprovou". Por isso cpf/gender/birthdate
-- nulos passam e só valores preenchidos precisam estar no formato.

alter table public.patients
  drop constraint if exists patients_members_check;
alter table public.patients
  add constraint patients_members_check
  check (public.patient_members_valid(kind, members));

-- ── 2) Vínculo só com cadastro individual que existe ─────────────────
-- Apagar um paciente individual — ou transformá-lo em casal — desfaz o
-- vínculo nos casais em que ele era uma das pessoas. Sem isto o casal
-- guardaria o id de um cadastro que não existe mais, ou passaria a ler os
-- dados de uma pessoa a partir de OUTRO casal. A pessoa continua no casal
-- com os dados copiados; só perde o vínculo.
create or replace function public.patients_unlink_members()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and not (old.kind = 'individual' and new.kind = 'couple') then
    return null;
  end if;

  update public.patients p
     set members = (
           select jsonb_agg(
                    case when m ->> 'patientId' = old.id
                         then jsonb_set(m, '{patientId}', 'null'::jsonb)
                         else m end
                    order by t.ord)
             from jsonb_array_elements(p.members) with ordinality as t(m, ord)
         )
   where p.kind = 'couple'
     and p.user_id = old.user_id
     and p.id <> old.id
     and exists (
           select 1 from jsonb_array_elements(p.members) m
            where m ->> 'patientId' = old.id
         );
  -- AFTER: o retorno é ignorado.
  return null;
end;
$$;

drop trigger if exists patients_unlink_members on public.patients;
create trigger patients_unlink_members
  after delete or update of kind on public.patients
  for each row execute function public.patients_unlink_members();

-- ── 3) Quem veio à sessão do casal ───────────────────────────────────
alter table public.appointments
  add column if not exists present_member_ids text[];

comment on column public.appointments.present_member_ids is
  'Sessão de casal atendida: ids (members[].id) de quem veio. null = todos.';

alter table public.appointments
  drop constraint if exists appointments_present_members_check;
alter table public.appointments
  add constraint appointments_present_members_check
  check (present_member_ids is null or cardinality(present_member_ids) >= 1);

-- Presença só existe em sessão atendida. Reagendar, desfazer ou virar falta
-- limpa — senão, se a sessão voltasse a ser atendida, reapareceria um
-- "só Fulana" que ninguém marcou. Trigger (e não o app) para valer também
-- nas RPCs e num app em cache.
create or replace function public.appointments_presence_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'attended' then
    new.present_member_ids := null;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_presence on public.appointments;
create trigger appointments_presence
  before insert or update on public.appointments
  for each row execute function public.appointments_presence_guard();
