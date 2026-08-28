# Cadastro de paciente — evoluções

| Migração | O quê |
|---|---|
| [`032_nascimento_opcional.sql`](032_nascimento_opcional.sql) | `patients.birthdate` passa a aceitar `NULL` (data de nascimento deixou de ser obrigatória) e normaliza strings vazias para `NULL`. |

## 032 — Data de nascimento opcional

**Motivo:** nem todo paciente chega com a data de nascimento em mãos; exigi-la
no cadastro travava o registro de pacientes novos.

**Aplicar:** SQL Editor do Supabase → colar o arquivo → Run. (Ou via MCP
`apply_migration`.) Enquanto a migração não roda, salvar um paciente **sem**
data de nascimento falha com erro de `not null` vindo do Postgres — o front já
envia `null`.

**Impacto no código:**

- `Patient.birthdate` é `string | null` ([`src/db/types.ts`](../../src/db/types.ts)).
- `ageFromBirthdate()` retorna `number | null`; use `ageLabel()`, que devolve
  `"12 anos"` ou `null` ([`src/domain/age.ts`](../../src/domain/age.ts)).
- As linhas de resumo (`/patients`, drawer do paciente, home, pendências,
  não-pagos) montam o texto com `filter(Boolean).join(" · ")`, então sem data
  fica só `"Feminino"` em vez de `"0 anos · Feminino"`.
- `PatientForm` valida a data só quando preenchida e grava `null` quando vazia;
  o campo ficou `clearable` para permitir apagar uma data já existente.
