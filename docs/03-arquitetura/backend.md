# Backend — Plugin Vite + Engine JSON

O "backend" é um conjunto de módulos Node carregados pelo dev-server do Vite. Não há Express nem
processo separado.

## Plugin Vite — `vite-plugin-json-db.ts`

```ts
configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith("/api/")) return next()
    const { handleApi } = await server.ssrLoadModule("/server/routes.ts")
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`)
    await handleApi(req, res, url)
  })
}
```

- Intercepta **apenas** `/api/*`; o resto segue para o Vite (frontend).
- Carrega `server/routes.ts` via `ssrLoadModule` → HMR do código de servidor durante o dev.
- Erros não tratados viram `500 { error: "internal", message }`.

## Roteador — `server/routes.ts`

`handleApi(req, res, url)` é um roteador manual baseado em comparação de `path` + `method` e
`RegExp` para rotas com parâmetro. Helpers:

- `send(res, status, body)` — JSON com `Cache-Control: no-store`.
- `bad` (400), `notFound` (404).
- `readBody(req)` — concatena chunks e faz `JSON.parse` tolerante (retorna `undefined` se inválido).
- `parse(schema, body)` — valida com Zod, retornando `{ ok, data }` ou `{ ok:false, details }`.
- `id(prefix)` — `prefix_ + nanoid(10)`.

### Normalização defensiva

Ao ler coleções, cada entidade passa por `normalize*` (ex.: `normalizePatient`,
`normalizeAppointment`, `normalizeSeries`, `normalizeInsurance`) que preenche campos novos ausentes
em dados antigos (`paid ?? false`, `insuranceId ?? null`, `avatarId ?? stable...`, etc.). Isso
permite **evolução de schema sem migração destrutiva** — arquivos antigos continuam válidos.

### Migração de pastas de documentos

`runPatientDocsMigration()` (executada uma vez por processo, via `ensureMigrations()` no início de
cada request) renomeia pastas legadas em `data/patient-documents/` do formato `<id>` para
`<slug>-<id>`, casando com os nomes atuais dos pacientes.

## Engine de dados — `server/db.ts`

Camada de I/O sobre arquivos JSON em `data/`.

### Cache em memória

`const cache = new Map<string, unknown>()` — cada coleção é carregada uma vez (lazy) e mantida em
memória; escritas são write-through (atualizam cache **e** disco). `bustCache(name?)` limpa.

### `load<T>(name, fallback)`

- Se em cache → retorna.
- Se arquivo **não existe** → grava o `fallback` e retorna (primeira execução legítima).
- Se o arquivo existe mas está **vazio** (`raw.trim() === ""`) ou com **JSON inválido** → salva uma
  **cópia** em `<name>.<timestamp>.corrupt.json` (via `copyFile`, **sem** remover o original) e
  **lança erro** instruindo a restaurar do backup. **Nunca** sobrescreve com o fallback.

> ⚠️ **Recuperação não-destrutiva.** Versões anteriores gravavam o fallback `[]` por cima de
> arquivos ilegíveis, o que (combinado com escrita sem `fsync`) podia zerar todos os dados após um
> crash. Corrigido — ver [incidente de perda de dados](../07-operacao/incidente-perda-dados.md).

### `update<T>(name, fallback, mutator)`

Núcleo das escritas. Garante **serialização por coleção** via fila de promessas (lock por mutex em
memória):

```
prev = locks.get(name) ?? resolved
next = prev.then(async () => {
  current = await load(name, fallback)
  updated = await mutator(structuredClone(current))   // mutator recebe cópia profunda
  cache.set(name, updated)
  await persist(name, updated)
  return updated
})
locks.set(name, next)
```

- O `mutator` opera sobre `structuredClone` do estado atual (imutabilidade defensiva).
- Operações concorrentes na mesma coleção são enfileiradas (last-write-wins dentro da fila, sem
  corrida).

### `persist<T>(name, value)` — escrita atômica e durável

1. `backupOncePerDay(name)`.
2. **Salvaguarda anti-vazio:** recusa gravar conteúdo vazio/`undefined`.
3. Escreve em arquivo temporário `<file>.<pid>.tmp` (JSON com indentação de 2) e faz **`fsync` do
   arquivo** (`fh.sync()`) antes do rename — garante que os bytes chegaram ao disco.
4. `rename(tmp, target)` — atômico.
5. Tenta **`fsync` do diretório** (durabilidade da entrada do rename); ignora se a plataforma não
   suportar.

> O `fsync` é essencial no NTFS: sem ele, o rename pode persistir antes dos dados após um crash,
> deixando o arquivo final com 0 bytes. Ver
> [incidente de perda de dados](../07-operacao/incidente-perda-dados.md).

### Backup — `backupOncePerDay` + `rotateBackups`

- Na primeira escrita do dia de cada coleção, copia o arquivo atual para
  `data/.backups/<YYYY-MM-DD>/<name>.json`.
- `rotateBackups` mantém **no máximo 7** pastas de data (remove as mais antigas).

### Utilitários

- `dataDir()` — caminho absoluto de `data/`.
- `slugifyName(name)` — normaliza (remove acentos, minúsculas, hífens) para nomes de pasta de
  documentos.

## Autenticação — `server/auth.ts`

- Usuário único persistido na coleção `user` (`StoredUser`).
- Senha com **scrypt** (`scryptSync`, key de 64 bytes, salt aleatório de 16 bytes em hex).
- `verifyPassword` usa `timingSafeEqual` (resistente a timing attack).
- `sanitizeUser` remove o hash antes de enviar ao cliente (`SafeUser`).
- `DEFAULT_USER`: `username="admin"`, senha `"admin"` (hash gerado em runtime). **Trocar no primeiro
  uso** — ver [segurança](../07-operacao/seguranca.md).

## Validação — `server/schemas.ts`

Schemas Zod para todos os corpos de request. Ver [validação de schemas](../04-api/validacao-schemas.md).

## Upload de arquivos

`POST /api/patients/:id/documents` usa **busboy** para parsear `multipart/form-data`, gera nome único
em colisão (`uniqueName`) e protege contra path traversal com `safeResolveInside` (ver
[segurança](../07-operacao/seguranca.md)).
