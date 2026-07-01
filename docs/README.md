# Documentação — PsicoBia

> Painel administrativo local para gestão de consultório de psicologia.
> Single-user, sem backend remoto, persistência em arquivos JSON dentro do próprio repositório.

Esta pasta documenta **tudo** sobre o projeto: regra de negócio, arquitetura, modelo de
dados, API, frontend, convenções de código e operação. É o ponto de entrada para qualquer
pessoa (ou agente) que precise entender, manter ou evoluir o sistema.

---

## Como navegar

| Pasta | Conteúdo |
|---|---|
| [`01-visao-geral/`](01-visao-geral/) | O que é o produto, para quem, capacidades em alto nível, glossário. |
| [`02-regras-de-negocio/`](02-regras-de-negocio/) | Domínio completo: pacientes, séries, ocorrências, recorrência, pendências, financeiro, ciclo de vida, fluxos. |
| [`03-arquitetura/`](03-arquitetura/) | Camadas, stack, backend (plugin Vite + engine JSON), frontend, modelo de dados. |
| [`04-api/`](04-api/) | Referência completa dos endpoints REST e schemas de validação. |
| [`05-frontend/`](05-frontend/) | Páginas, componentes, design system, gerenciamento de estado/dados. |
| [`06-convencoes/`](06-convencoes/) | Convenções de código, nomenclatura, padrões adotados. |
| [`07-operacao/`](07-operacao/) | Instalação (Windows), execução, dados/backup, segurança, [incidente de perda de dados](07-operacao/incidente-perda-dados.md). |
| [`08-capacidades.md`](08-capacidades.md) | Inventário exaustivo de tudo que o sistema faz. |
| [`09-leituras/`](09-leituras/) | **Módulo Leituras (proposta):** [plano de implementação](09-leituras/plano-de-implementacao.md) do acompanhamento de leitura (Track + Dashboard). |
| [`evolucao/`](evolucao/) | **Migração local → nuvem (Supabase):** plano, passo a passo e tracker de progresso. |

---

## Resumo de 30 segundos

- **Stack:** React 18 + TypeScript + Vite 6 + TailwindCSS + TanStack Query + Radix UI + Recharts.
- **Backend:** não há servidor separado. Um **plugin Vite** (`vite-plugin-json-db.ts`) intercepta
  `/api/*` durante `npm run dev` e roteia para handlers Node (`server/routes.ts`) que leem/escrevem
  arquivos JSON na pasta `data/`.
- **Persistência:** arquivos JSON (`data/*.json`), escrita atômica (tmp + rename), cache em memória,
  lock por mutex, backup diário rotativo (7 dias).
- **Autenticação:** usuário único, senha com hash `scrypt`. Sessão guardada no `localStorage`.
- **Domínio:** psicólogo cadastra pacientes, agenda atendimentos (únicos ou recorrentes), marca
  presença/falta, preenche checklist pós-sessão, controla pagamentos e acompanha pendências e
  finanças num dashboard.

> ⚠️ **Importante:** a aplicação roda **apenas em modo de desenvolvimento** (`npm run dev`). A API
> vive dentro do dev-server do Vite. Um `vite build` gera só o frontend estático **sem** a camada de
> dados. Ver [`07-operacao/execucao.md`](07-operacao/execucao.md).

---

## Estado da documentação vs. PLANNING.md

O arquivo [`/PLANNING.md`](../PLANNING.md) na raiz é o **plano original**. A implementação evoluiu
bastante além dele (convênios, alta/encerramento, anotações, documentos por paciente, pagamentos,
séries de agendamento, dashboard financeiro). **Esta documentação reflete o código atual** — onde
houver divergência, vale o que está aqui descrito e no código-fonte.
