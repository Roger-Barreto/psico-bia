# Terapia de casal

| Migração | O quê |
|---|---|
| [`035_casais.sql`](035_casais.sql) | `patients.kind` + `patients.members` (as pessoas do casal), validação por CHECK, desvínculo ao apagar paciente ou transformá-lo em casal; `appointments.present_member_ids` (quem veio). |

## O problema

A psicóloga também atende casais, mas o sistema só cadastrava pessoas. Nos dados de
produção o contorno estava à vista: um "paciente" chamado *"Fulana e Ciclano"*, com
gênero **Outro**, **sem data de nascimento** (não cabem duas) e **um único CPF** — com
série recorrente e sessão paga pendurados nele. Um segundo cadastro, arquivado, sugere
até sessão com um familiar.

Consequências do contorno: aniversário de nenhum dos dois, CPF de só um, o gráfico de
gênero contando o casal como "Outro", e nenhum jeito de registrar quando só um deles veio.

## A decisão de modelagem

**O casal é um paciente do tipo `couple`** — o *caso clínico* — com as pessoas dentro dele.

Agenda, séries, sessões, pagamentos, pacotes, checklist, anotações, documentos, alta e o
financeiro são todos pendurados em `patient_id`. Fazendo do casal um paciente, **tudo
isso passa a valer para casais sem nenhuma mudança** — e um cadastro de contorno vira
casal **no lugar** (mesmo id), sem perder nada.

A alternativa — a sessão ter vários pacientes — obrigaria a reescrever recorrência,
pendências, ledger, pacotes, alta e o trigger de consumo de pacote, para chegar ao mesmo
resultado com muito mais risco.

**`members` é jsonb, não uma tabela filha.** O casal e as pessoas gravam no mesmo update:
não existe o estado "casal sem pessoas" que duas escritas separadas permitiriam. A forma
é validada no banco por uma CHECK (`patient_members_valid`): 2 a 4 pessoas (há quem
atenda trisais), nome obrigatório, ids únicos, CPF/gênero/nascimento no formato quando
preenchidos, e cadastro individual com a lista vazia.

**Pessoa vinculada.** Uma pessoa do casal pode ser ligada ao cadastro individual dela
(`patientId`), quando ela também é atendida sozinha. Os dados passam a vir de lá (fonte
única); o casal guarda uma cópia, atualizada a cada salvamento. Se o cadastro individual
for **apagado** — ou virar casal —, um trigger desfaz o vínculo e o casal segue com a cópia. Pelo
formulário, quem já é pessoa vinculada a um casal nem chega a virar casal: aparece um aviso
para cadastrar um casal novo e vincular.

## Como funciona para quem usa

**Cadastrar.** *Novo paciente* → **Casal**. Duas pessoas por padrão (nome obrigatório;
gênero, nascimento e CPF opcionais; avatar de cada uma), *Adicionar pessoa* até 4. O
**nome do casal** é montado com os primeiros nomes (*"Ana & Rafael"*) e pode ser trocado
(*"Casal Souza"*). *CPF de quem paga* tem atalho *"Usar CPF de Ana"*.

**Converter um contorno.** Abrir o cadastro → **Casal**. O nome *"Carla e Davi"* é
separado nas duas pessoas, o CPF que existia vai para a primeira e continua como pagador,
e o nome antigo é mantido (com um atalho para adotar *"Carla & Davi"*). Agenda, sessões,
pagamentos e pacotes continuam como estavam. Também dá para voltar a individual (com
confirmação).

**Agendar e atender.** O casal aparece na busca do *Novo atendimento* (com selo
**Casal**, e é achado pelo nome de qualquer uma das pessoas). O resto é igual a um
paciente: atendido, falta, falta cobrada, reagendar, pagamento, pacote, checklist.

**Quando só um vem.** Em *Falta*, a opção **"Só parte do casal veio"** pergunta quem veio
e registra a sessão como **atendida** — é atendimento, gera checklist e cobrança. Depois,
no atendimento, o bloco **"Quem veio"** permite corrigir tocando em cada pessoa. A agenda
mostra *"Atendido · só Ana"*.

**Ligações.** No atendimento de um casal, *"Ana também em individual"* abre o cadastro
dela; no de uma pessoa atendida também em casal, *"Em terapia de casal: Ana & Rafael"*.

## O que muda em cada tela

| Tela | Casal |
|---|---|
| Pacientes | Selo **casal**, pessoas com idade, CPF de cada uma; filtro *Todos / Individuais / Casais* (só aparece se existir casal); busca pelas pessoas. Paciente individual que está num casal mostra *"Casal: …"*. |
| Agenda | Avatares sobrepostos, *"Casal · convênio"*, presença no status; busca pelas pessoas. |
| Atendimento | Cabeçalho com as pessoas e idades; *Quem veio*; ligações com o individual. O avatar se edita em cada pessoa, no cadastro. |
| Aniversários | Cada pessoa do casal faz aniversário (*"Rafael · casal Ana & Rafael"*). Quem está vinculado a um cadastro individual ativo aparece uma vez só, pelo individual. |
| Dashboard | *Em tratamento* mostra quantos são casais. O gráfico passou a **"Pessoas por gênero"**: cada pessoa do casal conta com o próprio gênero (sem dobrar quem também é individual); sem gênero informado vira *"Não informado"*. |
| Financeiro, pacotes, pendências | Iguais — o casal é o paciente. Lançamentos usam o nome do casal. |

## Presença (`appointments.present_member_ids`)

- `null` = todos vieram (o comum, e o que o app antigo grava).
- Lista com parte dos ids = só essas pessoas vieram. Lista vazia é recusada (ninguém veio
  é falta).
- Um trigger zera a presença quando a sessão deixa de estar atendida (reagendar, desfazer,
  falta) — senão um *"só Ana"* reapareceria se a sessão voltasse a ser atendida.
- Todos presentes grava `null`, para uma pessoa que entre no casal depois não aparecer como
  ausente nas sessões antigas.

## Compatibilidade

- **Rode a migração antes de publicar o frontend.** A ordem inversa é segura: o app antigo
  não manda as colunas novas e os defaults (`individual`, `[]`, `null`) são o de hoje.
- Um casal aberto num app antigo (PWA em cache) aparece como antes do recurso: um paciente
  chamado *"Ana & Rafael"*, gênero *Outro*.
- Nada muda para quem nunca cadastrar um casal.

## Ensaio da migração

Mesmo método da 034: um bloco `DO` aplica o DDL, roda os cenários como `authenticated` e
termina sempre em `RAISE EXCEPTION`, então nada é gravado. 21 cenários: pacientes
existentes viram individuais válidos, insert de app antigo, casal válido, oito formas
inválidas recusadas (1 pessoa, 5 pessoas, sem nome, CPF, gênero e nascimento inválidos,
ids repetidos, individual com pessoas), conversão no lugar preservando sessão paga e linha
no ledger, presença (só uma pessoa, lista vazia recusada, reagendar e falta limpam),
desvínculo ao apagar o individual **e ao transformá-lo em casal** (editar só o nome não
mexe no vínculo), e casal voltando a individual.

## Limites conhecidos

- **Família / sessão com familiar**: o modelo comporta (é uma lista de pessoas), mas a
  interface fala só em "casal".
- A **cobrança** é do casal: não há divisão automática de valor entre as pessoas nem
  cobrança diferente quando só uma vem (use *"usar valor diferente"* no pagamento).
- Sessão **individual de uma pessoa do casal** é agendada no cadastro individual dela
  (vincular ajuda a enxergar as duas coisas).
