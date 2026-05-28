# Visão Geral

## O que é

**PsicoBia** (nome interno do pacote: `admin-panel`) é um **painel administrativo local** para
psicólogos(as) gerenciarem a rotina clínica de um consultório individual. Cobre o ciclo completo:
cadastro de pacientes, agendamento de sessões, registro de presença/falta, checklist pós-sessão,
controle de pagamentos, encerramento de tratamento e um dashboard com indicadores clínicos e
financeiros.

O produto está marcado como **beta** na interface.

## Para quem

- **Usuário único** (single-user). Não há multi-tenant, papéis ou compartilhamento.
- Perfil: profissional autônomo de psicologia que atende em consultório próprio.
- Pensado para rodar **na própria máquina** do profissional (Windows 10/11), instalado por
  scripts `.bat` de duplo-clique — sem exigir conhecimento técnico do usuário final.

## Princípios de design do produto

1. **Local-first / privacidade.** Todos os dados (incluindo PII e documentos clínicos) ficam em
   arquivos na máquina do usuário, dentro de `data/`. Nada vai para servidor remoto. A pasta `data/`
   é git-ignored.
2. **Sem materializar o futuro.** Sessões recorrentes não são gravadas em massa; são **calculadas
   sob demanda** para o intervalo visível (ver [recorrência](../02-regras-de-negocio/recorrencia.md)).
3. **Histórico imutável.** Ao concluir uma sessão (atendido/falta), o checklist vigente é
   "congelado" num snapshot, de modo que edições futuras no checklist não alterem o passado.
4. **Soft-delete por padrão.** Pacientes, convênios, motivos e itens de checklist são **arquivados**,
   não apagados — preservando histórico. Há uma exclusão permanente explícita e separada.
5. **Feedback imediato.** Toasts (sonner) em toda mutação, confetes (canvas-confetti) ao concluir
   sessão/pagamento, e confirmações em ações destrutivas.

## Capacidades em alto nível

- **Pacientes:** CRUD, avatar (monstrinhos), gênero, data de nascimento (idade calculada), valor de
  consulta, convênio, checklist individual, anotações, documentos anexados, encerramento (alta) com
  motivo, reabertura e exclusão permanente.
- **Agenda:** mini-calendário mensal com indicadores (nº de pacientes, pendências, não-pagos);
  lista do dia selecionado; agendamento de atendimento único ou recorrente (semanal/quinzenal/mensal);
  reagendamento; desfazer (escopos: só este / este e futuros / série inteira).
- **Atendimento (drawer):** marcar atendido/falta, reagendar, preencher checklist do dia, controlar
  pagamento, ver/editar cadastro, adicionar anotações.
- **Checklist compartilhado:** itens globais herdados por todos os pacientes em toda sessão.
- **Convênios:** cadastro com valor padrão que pré-preenche o valor da consulta do paciente.
- **Motivos de encerramento:** lista configurável usada na alta.
- **Dashboard:** KPIs (atendidos, faltas, em tratamento, encerrados, novos, total de sessões),
  medidor financeiro (estimado × faturado × pendente), gráficos (faturamento por dia, sessões por
  status, top pacientes, faturamento dos últimos 6 meses, distribuição por gênero/convênio/motivo de
  alta), blocos de pendências e lista de pacientes não-pagos.
- **Perfil:** nome de exibição, avatar e troca de senha.

Inventário completo em [`08-capacidades.md`](../08-capacidades.md).

## O que o sistema **não** faz (limites conhecidos)

- Não é multiusuário; não há controle de acesso por papéis.
- Não funciona como site publicado: a API só existe no dev-server do Vite.
- Não há sincronização em nuvem nem backup externo automático (apenas cópias locais em
  `data/.backups/`).
- Não emite notas fiscais, recibos formais nem integra com gateways de pagamento — o "pagamento" é
  apenas um marcador interno de controle.
- Não há testes automatizados no repositório.
