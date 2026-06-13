# Capacidades — Inventário Completo

Lista exaustiva de tudo que o sistema faz, agrupado por área. Cada item aponta para a documentação
detalhada.

## Autenticação e perfil

- [x] Login com usuário único e senha (scrypt). → [segurança](07-operacao/seguranca.md)
- [x] Sessão persistida no `localStorage`; revalidação via `/api/me`.
- [x] Logout.
- [x] Editar nome de exibição e avatar do perfil.
- [x] Trocar senha (exige senha atual; mín. 8 caracteres; confirmação).
- [x] Login (username) imutável.

## Pacientes

- [x] Cadastrar (nome, gênero, data de nascimento, avatar, valor de consulta, convênio).
- [x] Idade calculada automaticamente da data de nascimento.
- [x] Avatar monstrinho (56 opções; aleatório/estável por ID).
- [x] Editar cadastro (com renomeação automática da pasta de documentos).
- [x] Arquivar (soft-delete) e reexibir arquivados.
- [x] Encerrar tratamento (alta) com data e motivo; prévia de futuros removidos.
- [x] Reabrir tratamento.
- [x] Excluir permanentemente (cascata: séries, atendimentos, anotações, checklist, documentos).
- [x] Busca por nome; deep-link `?edit=<id>`.
- → [domínio](02-regras-de-negocio/dominio.md), [ciclo de vida](02-regras-de-negocio/ciclo-de-vida-paciente.md)

## Checklist individual (por paciente)

- [x] Adicionar/arquivar itens específicos do paciente (aba Checklist do formulário).

## Anotações

- [x] Adicionar anotações de texto livre (até 2000 chars) por paciente.
- [x] Listar (mais recentes primeiro) e excluir, no drawer de atendimento.

## Documentos

- [x] Upload por drag-and-drop ou seleção (multi-arquivo).
- [x] Ícone por tipo de arquivo (PDF, DOC, XLS, CSV, imagem, áudio, vídeo, zip, txt…).
- [x] Download e exclusão.
- [x] "Abrir pasta no Explorer" (local).
- [x] Proteção contra path traversal; nome único em colisão.
- → [fluxos](02-regras-de-negocio/fluxos.md#anexar-documento), [segurança](07-operacao/seguranca.md)

## Agendamento

- [x] Agendar atendimento **único** ou **recorrente** (semanal/quinzenal/mensal).
- [x] Data final opcional para recorrências.
- [x] Combobox de paciente com busca acento-insensível e navegação por teclado.
- [x] Ocorrências calculadas sob demanda (sem materializar o futuro).
- [x] Reagendar uma sessão (move para nova data/horário).
- [x] Desfazer com escopo: só este / este e os próximos / série inteira.
- → [recorrência](02-regras-de-negocio/recorrencia.md), [fluxos](02-regras-de-negocio/fluxos.md)

## Atendimento (drawer)

- [x] Marcar **atendido** (gera snapshot do checklist; confete).
- [x] Marcar **falta** (gera snapshot; confete).
- [x] Reagendar a partir do drawer.
- [x] Mensagens contextuais (sessão futura, concluída, reagendada).
- [x] Editar cadastro do paciente sem sair do fluxo.
- [x] Trocar avatar inline.

## Checklist do dia

- [x] União de itens compartilhados + individuais (ou snapshot, se concluída).
- [x] Marcar/desmarcar itens com update otimista.
- [x] Contador `marcados / total`.
- [x] Itens não marcados em sessões passadas contam como pendência.
- → [pendências](02-regras-de-negocio/pendencias.md)

## Pagamentos

- [x] Marcar sessão atendida como paga (valor padrão ou customizado).
- [x] **Escolher a forma de pagamento ao marcar paga** (obrigatório; alimenta o módulo financeiro).
- [x] Desmarcar pagamento.
- [x] Registro de `paidAt`.
- [x] Alertas de "não pago" na agenda, no calendário e no dashboard.
- → [financeiro](02-regras-de-negocio/financeiro.md)

## Agenda (página)

- [x] Mini-calendário mensal com navegação.
- [x] Indicadores por dia: nº de pacientes (badge), pendências (ícone), não pagos (ícone $).
- [x] Lista do dia selecionado com horário, status, valor, badges.
- [x] Busca de paciente no dia.
- [x] Atalhos: novo atendimento, novo paciente.

## Dashboard

- [x] Seletor de mês (com transição animada).
- [x] Bloco de pendências (total / vencidas / hoje) e lista por paciente.
- [x] Medidor financeiro (estimado × faturado × pendente; % realizado).
- [x] Diálogo de pacientes não-pagos (com atalho para a sessão).
- [x] KPIs: atendidos, faltas, em tratamento, encerrados (total + mês), novos no mês, total de
  sessões.
- [x] Gráficos: faturamento por dia, sessões por status, top pacientes, faturamento 6 meses,
  distribuição por gênero, por convênio, por motivo de encerramento.
- [x] Skeletons de carregamento.
- → [paginas](05-frontend/paginas.md), [financeiro](02-regras-de-negocio/financeiro.md)

## Gestão financeira (PF + PJ)

- [x] Módulo `/financeiro` separado: receitas/despesas pessoais (PF) e da clínica (PJ).
- [x] Lançar receita ou despesa com categoria, forma de pagamento, data de competência e escopo.
- [x] Criar categoria/forma/pessoa **inline** no formulário.
- [x] Marcar pago/recebido por lançamento.
- [x] **Recorrente** (mensal infinito) com edição/exclusão por escopo (este / futuros / todos).
- [x] **Parcelado** em N meses (parcelas iguais; última absorve a sobra).
- [x] **Empréstimos** vinculados a uma pessoa; "emprestei pra alguém" gera saída + a-receber ligados.
- [x] **Extrato por pessoa** com saldo em aberto `(me devem) − (eu devo)`.
- [x] **Faturamento da clínica automático** (derivado das sessões atendidas, read-only).
- [x] **Dashboard financeiro**: receitas×despesas, fluxo acumulado, por categoria, por forma,
  PJ×PF, saldo por pessoa; período selecionável (mês/3/6/12 meses).
- [x] CRUD de categorias, formas de pagamento e pessoas (arquivar/restaurar).
- → [financeiro-pessoal](02-regras-de-negocio/financeiro-pessoal.md)

## Cadastros auxiliares

- [x] Checklist **compartilhado** (global): CRUD + arquivar/restaurar.
- [x] **Convênios**: nome + valor padrão (sugere valor da consulta); arquivar/restaurar.
- [x] **Motivos de encerramento**: CRUD + arquivar/restaurar.

## Dados e operação

- [x] Persistência em arquivos JSON locais.
- [x] Escrita atômica + lock por coleção + cache em memória.
- [x] Backup diário rotativo (7 dias).
- [x] Recuperação de arquivo corrompido (move para `.corrupt`, recria vazio).
- [x] Normalização defensiva (schema evolutivo sem migração).
- [x] Instaladores Windows (instalar / iniciar / atualizar / encerrar).
- → [dados e backup](07-operacao/dados-e-backup.md), [instalação](07-operacao/instalacao.md)

## Experiência

- [x] Tema escuro único (navy + rosa + amarelo).
- [x] Toasts em todas as operações.
- [x] Confetes em marcos (atender/pagar = feliz; faltar/reagendar = triste).
- [x] Confirmações em ações destrutivas.
- [x] UI 100% em português (datas e moeda localizadas pt-BR).

---

## Limitações conhecidas (não-capacidades)

- [ ] Multiusuário / papéis de acesso.
- [ ] API funcionando em build estático (só roda sob `npm run dev`).
- [ ] Autenticação por token nos endpoints (proteção é client-side).
- [ ] Criptografia de dados em repouso.
- [ ] Sincronização em nuvem / backup externo automático.
- [ ] Emissão fiscal / recibos / gateway de pagamento.
- [ ] Testes automatizados.
- → detalhes em [visão geral](01-visao-geral/visao-geral.md#o-que-o-sistema-não-faz-limites-conhecidos)
  e [segurança](07-operacao/seguranca.md).
