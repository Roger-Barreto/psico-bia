# Pacotes de sessões

| Migração | O quê |
|---|---|
| [`034_pacotes_sessoes.sql`](034_pacotes_sessoes.sql) | Tabela `session_packages`, coluna `appointments.package_id`, trigger de consumo, RPC `create_session_package`, 4º braço do `finance_ledger`. |

## O problema

Alguns pacientes fecham, numa sessão, um **pacote de sessões** por um valor combinado —
que varia de paciente para paciente — e pagam na hora. Ex.: na sessão de terça o
paciente fecha 4 sessões por R$ 400,00.

Antes, a psicóloga registrava os R$ 400,00 na primeira sessão e **R$ 0,00 à mão** em
cada uma das seguintes. Nada dizia quantas sessões ainda faltavam, e esquecer de zerar
uma delas criava uma cobrança que não existia.

## Como funciona para quem usa

**Vender o pacote.** No atendimento, *Marcar como paga* → **Novo pacote** → quantidade
de sessões, valor total e forma de pagamento. A opção *"Esta sessão já é a 1ª do
pacote"* vem marcada. O valor começa em `sessões × valor da consulta` e acompanha a
quantidade até ser editado — é só um ponto de partida.

**Consumir.** Nas próximas sessões não há nada a fazer: ao marcar **Atendido**, a
sessão é descontada do pacote sozinha e o aviso diz a posição (*"descontada do pacote
(sessão 2 de 4)"*). Uma **falta cobrada** também consome uma sessão; a falta comum, não.

**Acompanhar.**

| Onde | O que mostra |
|---|---|
| **Clínica › Pacotes** (`/pacotes`) | Todos os pacotes, com filtro *Em andamento / Concluídos / Encerrados / Todos*, busca por paciente e os totais: pacotes em andamento, **sessões a realizar** e o valor já recebido por elas. |
| Drawer do atendimento | Cartão *Pacote* com a barra de uso; na sessão paga pelo pacote, *"Paga pelo pacote · sessão 2 de 4"*. |
| Cadastro do paciente › aba **Pacotes** | Os pacotes daquele paciente (em andamento primeiro) e *Novo pacote*. |
| Agenda | Selo no cartão do dia: *Pacote 2/4* (já descontada) ou *Pacote · restam 2* (ainda vai acontecer). |
| Detalhe do pacote | Cada sessão usada, com data e se foi atendida ou falta cobrada; *Editar*, *Encerrar/Reabrir*, *Excluir*. |

**Exceções, todas reversíveis:**

- *Tirar do pacote* — a sessão volta para o saldo e fica como não paga (para cobrar à parte).
- *Descontar do pacote* — paga com o saldo uma sessão que estava em aberto, inclusive
  uma **anterior à venda** (dívida antiga que o paciente resolveu quitar com o pacote).
- *Encerrar* — o saldo que sobrou deixa de ser usado; o dinheiro continua no financeiro.
- *Excluir* — some o pacote e a receita dele; as sessões que ele pagou voltam a "não paga".

## Decisões de modelagem

**O saldo não é armazenado.** Sessões usadas = linhas de `appointments` com
`package_id` apontando para o pacote. Não existe contador para dessincronizar: desfazer,
reagendar ou apagar uma sessão devolve a vaga por construção.

**Regime de caixa.** O paciente pagou tudo no dia da venda, então a receita entra
inteira nesse dia — uma linha própria no ledger (categoria *Pacotes de sessões*). As
sessões cobertas ficam `paid = true` com `paid_value = 0`: é exatamente o que a
psicóloga já fazia à mão, agora sem o trabalho. Elas **saem** do ledger, para não virar
uma fileira de lançamentos de R$ 0,00.

**O pacote é uma entidade, não um valor pendurado na primeira sessão.** Guardar os
R$ 400,00 em `paid_value` da sessão da venda faria a receita sumir quando essa sessão
fosse desfeita ou reagendada, e não haveria onde registrar um pacote vendido fora de
uma sessão.

**O consumo é feito por trigger, não pelo app.** Um `BEFORE INSERT OR UPDATE` em
`appointments` decide tudo. Motivos:

- vale para qualquer caminho que mexa na sessão — marcar atendido, falta cobrada,
  reagendar, as RPCs `bulk_delete_appointments`/`discharge_patient`, e um **app em
  cache na versão anterior**, que não sabe o que é pacote;
- é atômico: o `select … for update` no pacote impede dois aparelhos de gastarem a
  mesma última vaga.

O app só **lê** o resultado. [`src/domain/packages.ts`](../../src/domain/packages.ts)
espelha a regra para a tela avisar o que vai acontecer, nunca para decidir.

## Regras do trigger

Invariante: **`package_id` preenchido ⇒ sessão cobrável, `paid = true`, `paid_value = 0`.**

| # | Situação | Efeito |
|---|---|---|
| 1a | Sessão de pacote deixa de ser cobrável (reagendada, desfeita, falta sem cobrança) | Solta o vínculo e limpa o pagamento — a vaga volta ao saldo. |
| 1b | Vínculo **novo** | Recusa sessão que já tem pagamento próprio (`appointment_already_paid`) — o vínculo zeraria o valor recebido. Valida: pacote existe, é do mesmo paciente/conta, está aberto e tem vaga; senão, erro (`package_not_found`, `package_closed`, `package_full`). Grava pago, valor 0 e a forma de pagamento do pacote. |
| 1c | Vínculo antigo e alguém gravou `paid = false` | Solta o vínculo. É o que faz o *Desmarcar* de um app antigo funcionar. |
| 2 | Vínculo removido (pelo app, ou pelo `on delete set null` ao apagar o pacote) | Se o **valor** não foi tocado, ainda é o 0 do pacote: a sessão volta a "não paga" e sem valor próprio (senão ficaria valendo R$ 0,00). Se veio um valor novo no mesmo update — tirar do pacote e cobrar à parte —, ele fica. |
| 3 | Sessão **acabou de virar** cobrável, não está paga, e o paciente tem pacote aberto com vaga e `start_date ≤ data da sessão` | Consome do pacote mais antigo. O pacote é relido **já com o lock** antes de contar as vagas: outro aparelho pode tê-lo encerrado ou encolhido no meio do caminho. |

A regra 3 só dispara **na transição**: quem tirou a sessão do pacote de propósito não a
vê voltar sozinha na próxima edição. E exige `start_date ≤ data`: uma sessão de antes da
venda não é descontada sozinha (só pelo vínculo manual).

**Upsert.** O app grava sessões com `INSERT … ON CONFLICT DO UPDATE`, e nesse comando o
`BEFORE INSERT` dispara mesmo quando a linha já existe. Se o trigger consumisse o pacote
nessa fase, o `paid = true` iria para o `EXCLUDED` e o `UPDATE` seguinte veria uma
sessão "já paga" sem pacote. Por isso, na fase de insert sobre linha existente, o trigger
aplica só a regra 1a (que não depende do estado anterior) e deixa o resto para o
`BEFORE UPDATE`.

## Dinheiro nas telas

| Tela | O que muda |
|---|---|
| Dashboard clínico — **Faturado**, faturamento por dia, faturamento mensal, formas de pagamento | Somam o pacote no dia da venda. |
| Dashboard clínico — **Estimado** | Soma os pacotes vendidos no mês e **não** conta as sessões que o saldo vai pagar ([`projectedCoverage`](../../src/domain/packages.ts)). O saldo é distribuído em ordem de data **desde o dia da venda** — uma sessão pendente do mês passado gasta o saldo antes das deste mês ([`usePackageCoverage`](../../src/components/packages/use-package-coverage.ts)). |
| Agenda — selo do cartão | Mesma projeção: com 1 sessão no pacote e 4 na agenda, só a primeira leva o selo; as outras seguem mostrando o valor a cobrar. |
| Dashboard clínico — **Pendente** | Sessão agendada e vencida que o saldo cobre não entra como valor a receber. |
| Financeiro › Lançamentos e Dashboard | Linha *"Pacote de 4 sessões — Nome"*, recebida, categoria *Pacotes de sessões*. |
| Cofrinhos com meta % da receita clínica | A venda do pacote conta como receita recebida no dia. |

## Ensaio da migração

A migração foi ensaiada **no banco de produção dentro de uma transação que nunca é
gravada**: um único bloco `DO` aplica o DDL, cria dados de teste `zz_*`, percorre 30
cenários como o papel `authenticated` e termina sempre em `RAISE EXCEPTION` — que desfaz
tudo e devolve o resultado na mensagem do erro. Cobertos: venda com vínculo, consumo por
insert e pelo caminho do `ON CONFLICT`, falta cobrada, pacote cheio, reagendar, desfazer
(RPC), desmarcar por app antigo, encerrar/reabrir, FIFO entre dois pacotes, apagar
pacote, apagar paciente, guardas de edição, sessão já paga recusada, desvincular sem
mandar valor, paciente sem pacote (nada muda), ledger e RLS entre contas.

Depois de aplicada de verdade, o `finance_ledger` foi comparado linha a linha com a
definição anterior recalculada à mão: 884 linhas, nenhuma diferença.

## Aplicar

SQL Editor do Supabase → colar o arquivo → Run (ou MCP `apply_migration`). **Antes de
publicar o frontend.** A ordem inversa é segura para o app antigo: sem nenhum pacote
cadastrado o trigger não altera nada e as views devolvem o mesmo que antes.

## Impacto no código

- Tipos: `Appointment.packageId`, `SessionPackage`, `PackageSession`
  ([`src/db/types.ts`](../../src/db/types.ts)).
- Dados: `useSessionPackages`, `useCreateSessionPackage`, `useUpdateSessionPackage`,
  `useDeleteSessionPackage`, `packageErrorMessage`
  ([`src/api/queries.ts`](../../src/api/queries.ts)). O pacote vem com as sessões
  embutidas (`appointments(...)`), numa ida ao banco.
- Domínio: [`src/domain/packages.ts`](../../src/domain/packages.ts).
- UI: [`src/components/packages/`](../../src/components/packages/),
  [`src/pages/packages.tsx`](../../src/pages/packages.tsx),
  [`payment-control.tsx`](../../src/components/patient/payment-control.tsx),
  [`missed-appointment-dialog.tsx`](../../src/components/appointments/missed-appointment-dialog.tsx),
  [`patient-drawer.tsx`](../../src/components/patient/patient-drawer.tsx).
- Extraídos para reuso: `PaymentMethodChips` e `PatientCombobox`.

## Limites conhecidos

- **Pacote é sempre pago na venda.** Não há pacote "a receber" nem parcelado.
- **A posição da sessão é pela data**, não pela ordem em que foi descontada: confirmar
  hoje uma sessão antiga a coloca antes das posteriores.
- **Paciente arquivado:** o pacote some das telas e do ledger, como as sessões dele.
- **Encerrar o tratamento** não encerra o pacote; a confirmação avisa quantas sessões
  pagas ficaram sem realizar.
