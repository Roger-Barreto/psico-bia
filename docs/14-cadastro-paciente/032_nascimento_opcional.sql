-- ============================================================
-- 032_nascimento_opcional.sql — data de nascimento deixa de ser obrigatória
--
-- `patients.birthdate` foi criada em 001_initial_schema como
-- `text not null`. O cadastro passou a aceitar paciente sem data de
-- nascimento (a idade simplesmente não aparece nas listagens), então a
-- coluna precisa aceitar NULL.
--
-- Também normaliza para NULL as linhas que porventura tenham string
-- vazia, para que o front tenha um único valor "sem data".
--
-- Idempotente: pode rodar de novo sem efeito.
-- ============================================================

alter table public.patients
  alter column birthdate drop not null;

update public.patients
   set birthdate = null
 where birthdate is not null
   and btrim(birthdate) = '';
