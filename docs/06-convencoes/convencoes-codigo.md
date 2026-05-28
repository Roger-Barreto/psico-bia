# Convenções de Código

Padrões observados no repositório. Seguir para manter consistência.

## TypeScript

- **Strict total** (`tsconfig.app.json`): `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`. Target ES2022, `moduleResolution: bundler`, `jsx: react-jsx`.
- **Sem `any`** na prática; preferir tipos explícitos e `unknown` + validação nas bordas.
- Tipos de domínio centralizados em [`src/db/types.ts`](../../src/db/types.ts); o backend redeclara
  interfaces equivalentes em `server/routes.ts` (não há tipos compartilhados cross-boundary além de
  `monster-avatars` e schemas).
- Parâmetros não usados são prefixados com `_` (ex.: `_patient`, `void _patient`) para satisfazer
  `noUnusedParameters`.

## Imports

- Alias **`@/`** → `src/` (configurado em todos os tsconfig + vite). Usar `@/...` em vez de caminhos
  relativos longos.
- Ícones Phosphor importados **nominalmente** (`import { CheckIcon } from "@phosphor-icons/react"`),
  nunca via barrel completo — preserva tree-shaking.

## Nomenclatura

- **Arquivos:** `kebab-case.tsx` / `.ts` (ex.: `patient-drawer.tsx`, `mini-calendar.tsx`).
- **Componentes/Tipos:** `PascalCase`.
- **Funções/variáveis:** `camelCase`.
- **Hooks:** prefixo `use` (`usePatients`, `useUpsertAppointment`).
- **Query keys:** centralizadas no objeto `qk`.
- **Domínio:** funções puras com nomes descritivos (`occurrencesForPatient`, `pendencyCount`,
  `effectiveValue`).

## Organização por feature

`components/` é dividido por feature (`patient/`, `appointments/`, `dashboard/`, `calendar/`,
`profile/`) + `ui/` para primitivos reutilizáveis. Páginas em `pages/`. Lógica pura em `domain/`.

## React

- Componentes funcionais + hooks. `useMemo` para dados derivados pesados; `useState` para estado
  local de UI.
- **Sem estado global** além do `AuthContext` — o resto é cache do React Query ou estado local.
- Efeitos colaterais de servidor sempre via mutations do React Query (nunca `fetch` solto em
  componentes — exceto `auth-context`, que chama `/api/login`/`/api/me` diretamente).
- Reset de formulário ao abrir/fechar `Sheet`/`Dialog` via `key` ou `useEffect([open])`.

## Estilo (Tailwind)

- Classes utilitárias inline; composição condicional via `cn(...)` (`clsx` + `tailwind-merge`).
- Cores semânticas via tokens (`bg-primary`, `text-muted-foreground`); status pontuais com paletas
  diretas (`emerald`/`amber`/`destructive`).
- Variantes de componente via `class-variance-authority` (ex.: `button`).

## Backend

- Roteador manual (comparação de `path`/`method` + `RegExp`). Validação Zod **antes** de mutar dados.
- Escritas sempre via `update(name, fallback, mutator)` (lock + atômico); leituras via `load`.
- Mutators recebem `structuredClone` — não mutar o argumento diretamente fora do retorno.
- Normalização defensiva (`normalize*`) ao ler coleções, para compatibilidade com dados antigos.

## Idioma

- **UI e mensagens ao usuário em português** (pt-BR): labels, toasts, validações, datas/moeda
  localizadas.
- **Código (identificadores) em inglês**; comentários ora em inglês, ora em português (mistos).

## Comentários

- Predominam comentários **explicando o "porquê"** (ex.: motivo do snapshot, decisão de cache),
  separadores de seção (`// ─── SHARED CHECKLIST ───`) e JSDoc nas funções de domínio.

## Lint

- ESLint configurado via `npm run lint` (flat config implícito; ver dependências). Sem testes
  automatizados no repositório.
