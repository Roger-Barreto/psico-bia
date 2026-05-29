# Evolução — De local para nuvem (Supabase)

> Esta pasta documenta a migração do PsicoBia de uma aplicação **local single-machine**
> para uma aplicação **acessível publicamente** por iPad, iPhone e notebook Windows.

---

## Por que estamos mudando

Hoje o app roda **apenas em `npm run dev`** numa única máquina: a API vive dentro do
dev-server do Vite e os dados ficam em arquivos JSON dentro do repositório
(ver [`../03-arquitetura/backend.md`](../03-arquitetura/backend.md)).

Novo objetivo:

- Acessar de **iPad** (uso principal), **iPhone** e **notebook Windows**.
- **Custo mais baixo possível**, idealmente **zero**.
- **Seguro**, pois ficará hospedado de forma pública (dados de saúde = sensíveis sob LGPD).

## Decisão de arquitetura: **Supabase-direct (Opção A)**

O frontend passa a falar **direto com o Supabase** — sem API própria no meio:

| Camada | Antes | Depois |
|---|---|---|
| Dados gerais | Arquivos JSON em `data/` | **Postgres** (Supabase) |
| Documentos de paciente | Arquivos no disco local | **Supabase Storage** (bucket privado) |
| Autenticação | Cosmética (localStorage) | **Supabase Auth** (sessão real) |
| Segurança | Nenhuma no servidor | **RLS** (Row Level Security) no Postgres |
| Hospedagem | `localhost` | Frontend estático (Cloudflare Pages / Vercel) |

### Por que não uma API separada?

Era a intuição inicial, mas com Supabase **não é necessária** para CRUD. O modelo dele é:
o frontend usa a `anon key` (pública de propósito) e a segurança vem do **RLS** no banco.
A `anon key` no bundle é segura **porque** o RLS protege cada linha. Só é preciso lógica de
servidor onde algo não pode ser adulterado pelo cliente — e no PsicoBia isso se resume a
**3 cascatas de mutação**, que viram funções SQL (RPC).

### Por que o esforço é menor do que parece

Toda a lógica pesada de domínio (**recorrência**, **pendências**, **checklist**) já é
client-side e **pura** — opera sobre linhas cruas
([`../../src/domain/recurrence.ts`](../../src/domain/recurrence.ts),
[`../../src/domain/pendencies.ts`](../../src/domain/pendencies.ts)). Ela **não muda**.

Só precisa virar SQL/RPC:

1. `discharge_patient` — alta: atualiza paciente + capa fim das séries + apaga sessões futuras agendadas.
2. `bulk_delete_appointments` — desfazer agendamento em lote (escopo um / futuros / todos).
3. `scrub_checklist_item` — remoção permanente de item: tira o id dos arrays de todas as sessões.

E o rewrite do frontend concentra-se em **um arquivo**: [`../../src/api/queries.ts`](../../src/api/queries.ts),
porque todos os hooks passam pelo objeto `api`.

---

## O que é descartado

- Feature **"abrir pasta no explorer"** (`useOpenPatientFolder`) — é local-only, morre.
- Toda a **engine de durabilidade JSON** (`server/db.ts`: fsync, tmp+rename, backup) — o Supabase cuida.
- O **plugin Vite** (`vite-plugin-json-db.ts`) e a pasta `server/` — removidos ao final.

---

## ⚠️ Bloqueador crítico de segurança (resolvido pela migração)

Na versão atual, **nenhuma rota `/api/*` verifica autenticação**. O login só guarda o usuário
no `localStorage`. Isso é tolerável em `localhost`, mas seria **vazamento total de prontuários**
se exposto publicamente. A migração resolve isso com Supabase Auth + RLS — **mas só se o RLS
estiver ativo em todas as tabelas e o bucket for privado.** Ver checklist em [`passo-a-passo.md`](passo-a-passo.md).

---

## Arquivos desta pasta

| Arquivo | Conteúdo |
|---|---|
| [`passo-a-passo.md`](passo-a-passo.md) | Guia completo do zero: criar conta no Supabase, schema SQL, RLS, RPCs, Storage, frontend, migração de dados, deploy. |
| [`progresso.md`](progresso.md) | Checklist de acompanhamento — marque conforme avança para não perder o fio. |

## Limites do plano free do Supabase (vigiar)

- **500 MB** de banco Postgres.
- **1 GB** de Storage (os documentos dos pacientes podem estourar com o tempo → depois ~US$ 0,021/GB).
- **Projeto pausa após 7 dias sem nenhuma requisição** (uso diário não é afetado; basta abrir o app).
- 5 GB de banda/mês.
