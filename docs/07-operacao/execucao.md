# Execução, Build e Scripts

## Scripts npm (`package.json`)

| Script | Comando | O que faz |
|---|---|---|
| `dev` | `vite` | Sobe o dev-server **com a API** (plugin json-db). É o modo de uso normal. |
| `build` | `tsc -b && vite build` | Type-check + build estático do frontend (**sem API**). |
| `lint` | `eslint .` | Lint. |
| `preview` | `vite preview` | Serve o build estático (sem API). |

## Modo normal: `npm run dev`

- Porta **5173** (`vite.config.ts`, `strictPort: true`; sobrescrevível por `PORT`).
- O middleware do plugin intercepta `/api/*`; o resto é servido pelo Vite com HMR.
- Os dados são lidos/gravados em `data/` relativo ao **cwd** do processo.

> ⚠️ **A aplicação depende do dev-server.** A API só existe sob `npm run dev`. `build`/`preview`
> geram/servem apenas o frontend; chamadas a `/api/*` falham nesse modo. Para "produção" local,
> mantém-se o `npm run dev` rodando (é o que os instaladores fazem).

## Pré-requisitos

- Node.js LTS (ver `@types/node` ^22; engine não fixada no `package.json`).
- npm (lockfile `package-lock.json` presente).

## Variáveis de ambiente

- `PORT` — porta do dev-server (default 5173).

## Estrutura de execução

```
npm run dev
  └ vite (porta 5173)
      ├ frontend (src/) com HMR
      └ middleware /api/* → server/routes.ts (SSR load, HMR)
            └ server/db.ts → data/*.json
```

## Type-check

`tsc -b` usa project references (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`).
`noEmit: true` — TypeScript só valida; o bundle é do Vite.

## Dev em IDE

`.claude/launch.json` define uma configuração "admin-panel" que roda `npx vite --port 5174
--strictPort` com `autoPort` — útil para depuração paralela sem colidir com a porta 5173.

## Notas de plataforma

- Os instaladores e o "abrir pasta" assumem Windows, mas o código tem ramos para macOS (`open`) e
  Linux (`xdg-open`) em `openInExplorer`, e `safeResolveInside` trata separador por plataforma.
- O dev-server roda igual em qualquer SO via `npm run dev`.
