# Compromissos pessoais na agenda

| Migração | O quê |
|---|---|
| [`036_compromissos.sql`](036_compromissos.sql) | `agenda_categories` (cor + ícone), `agenda_events` (o compromisso, avulso ou regra de repetição), `agenda_event_skips` (dias removidos de uma repetição), RLS por conta e `seed_agenda_defaults()`. |

## O problema

A agenda só conhecia atendimentos. Consulta médica, pilates, supervisão, férias — tudo
isso vivia em outro aplicativo, e o resultado era marcar paciente em cima de um
compromisso próprio. O objetivo é a profissional gerir **a agenda inteira** aqui, sem
app de terceiros.

## A decisão de modelagem

**Regra + exceções, nada materializado** — o mesmo desenho dos atendimentos
(`appointment_series` + `appointments`):

- `agenda_events` é o compromisso. Com `frequency = null` é avulso; senão é a **regra**
  de uma repetição, e as ocorrências são calculadas no cliente
  ([`src/domain/events.ts`](../../src/domain/events.ts)).
- `agenda_event_skips` guarda os dias removidos de uma repetição.

Não existe tabela de "ocorrência alterada". Os três alcances de edição se resolvem com o
que já há:

| Alcance | O que grava |
|---|---|
| **Só este dia** | pula a data na regra + cria um compromisso avulso com o que foi editado |
| **Este e os próximos** | encerra a regra na véspera (`end_date`) + cria outra a partir daqui |
| **Todos** | atualiza a regra. O começo da série é preservado; só anda se o dia foi alterado (e anda o mesmo tanto) — senão editar a 5ª terça apagaria as quatro anteriores |

Sempre grava o novo antes de mexer no antigo: se a segunda escrita falhar, sobra uma
duplicata visível, nunca um compromisso perdido.

**Repetições:** todo dia, toda semana (com **vários dias** — "pilates terça e quinta" é
uma regra só), a cada 2 semanas, todo mês (mesmo dia; em mês curto cai no último dia) e
todo ano. Com ou sem data final. "Férias de 20 a 31" é *todo dia até 31*, dia inteiro.

**Datas e horas são `text`** (`YYYY-MM-DD`, `HH:MM`), como no resto do esquema. O
compromisso não atravessa a meia-noite (`end_time > start_time`, garantido por CHECK).

**`busy` — "Ocupa meu horário".** É o que faz o app avisar ao agendar um paciente em
cima. Desligado, o compromisso é só um lembrete ("aniversário da mãe") e nunca gera
aviso.

**Categorias são do usuário** (nome, cor, ícone), criadas e editadas no próprio diálogo
do compromisso. Sete nascem prontas no primeiro acesso (`seed_agenda_defaults`): Saúde,
Exercício, Pessoal, Família, Estudo, Trabalho, Lazer. As cores iniciais são **frias de
propósito**: rosa, âmbar, verde e vermelho já são os estados dos atendimentos (a atender,
não pago, concluído, pendência). Apagar uma categoria não apaga compromissos — eles
ficam sem categoria (cinza).

## Conflito de horário

O atendimento só guarda a hora de início; para conflito ele vale **50 min**
(`SESSION_MINUTES`, o mesmo fallback previsto em
[13-google-agenda](../13-google-agenda/plano-de-implementacao.md) para quando a duração
for configurável). Compromisso de dia inteiro toma o dia todo. Encostar não é conflito
(sessão 14:00–14:50 e compromisso às 14:50 convivem).

**O app avisa, não bloqueia.** Dois pacientes no mesmo horário continuam bloqueados
(regra antiga); já entre paciente e compromisso quem decide é a profissional — ela pode
faltar ao pilates, o sistema não sabe. O aviso aparece em todo lugar onde o choque pode
nascer ou ser visto:

| Onde | O quê |
|---|---|
| **Novo atendimento** | lista os compromissos que batem com o horário (numa série, olha ~6 meses e agrupa por compromisso); o botão vira *Agendar mesmo assim*. No atendimento único mostra também o que mais há **no mesmo dia** |
| **Reagendar** (drawer) | mesmo aviso para a nova data/hora |
| **Novo/editar compromisso** | lista os atendimentos que caem no horário (numa repetição, ~6 meses) |
| **Lista do dia** | *"Coincide com…"* nos dois cartões envolvidos |

## Como aparece na agenda

- **Botão *Novo compromisso*** ao lado de *Novo atendimento*.
- **Lista do dia numa linha do tempo só:** dia inteiro no topo, depois atendimentos e
  compromissos misturados por hora. O cartão do compromisso segue o ritmo do de paciente
  (hora à esquerda, selo à direita) mas não se confunde: faixa lateral e fundo na cor da
  categoria, ícone num **quadrado** (o paciente é um avatar redondo), início **e** fim, e
  nenhum estado de atendimento. Clicar abre a edição.
- **Mini-calendário:** uma barrinha no pé do dia, com um trecho por categoria presente
  (até 3). O número âmbar continua sendo só de pacientes.
- **Busca** do dia acha compromisso por título, categoria ou local.

## Segurança

RLS em tudo (`user_id = auth.uid()`), políticas só para `authenticated`, `anon` sem
acesso. O `with check` de `agenda_events` e de `agenda_event_skips` também barra apontar
para categoria/compromisso de outra conta (a FK sozinha não olha RLS).
`seed_agenda_defaults` roda como o próprio usuário (sem `security definer`).

Ensaio da migração (transação revertida, ver o padrão em `035`): constraints de hora,
repetição e dias da semana; isolamento entre duas contas (leitura, update, delete e
insert cruzado); `anon` sem `select` nem `execute`; cascatas (`skips` somem com o
compromisso; categoria apagada deixa `category_id = null`).

## Fora do escopo (por enquanto)

- Sincronizar com Google Agenda — segue como proposta em
  [13-google-agenda](../13-google-agenda/plano-de-implementacao.md); esta entrega é o
  caminho "tudo dentro do app".
- Compromisso que atravessa a meia-noite ou dura vários dias com hora marcada.
- Notificações/lembretes push.
