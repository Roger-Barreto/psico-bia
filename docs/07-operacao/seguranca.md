# Segurança

Modelo de ameaça assumido: **aplicação local, single-user, na máquina do próprio profissional**. As
escolhas refletem esse contexto — não é um serviço exposto à internet.

## Autenticação

- **Usuário único** persistido em `data/user.json` (`StoredUser`).
- Senha com **scrypt** (`server/auth.ts`): `scryptSync`, key de 64 bytes, salt aleatório de 16 bytes
  (hex). Verificação com `timingSafeEqual` (resistente a timing attack).
- O hash **nunca** é enviado ao cliente (`sanitizeUser` → `SafeUser`).
- **Usuário padrão:** `admin` / `admin` (`DEFAULT_USER`). ⚠️ **Trocar a senha no primeiro uso** pelo
  menu Perfil → Senha (mín. 8 caracteres).

### Limitações conscientes

- **Não há token de sessão.** Após o login, os endpoints `/api/*` **não exigem credencial** — a
  proteção é apenas o roteamento client-side (`ProtectedRoute`). Qualquer processo capaz de chamar
  `http://localhost:5173/api/*` acessa os dados.
- A sessão do cliente fica em `localStorage` (`admin-panel.auth`), sem expiração.
- Aceitável porque a API só escuta em `localhost` no dev-server da máquina do usuário. **Não exponha
  a porta 5173 na rede** sem adicionar autenticação real.

## Proteção contra path traversal (documentos)

`safeResolveInside(parent, child)` em `server/routes.ts`:
- Resolve `resolve(parent, basename(child))` e confirma que o resultado está **dentro** do diretório
  do paciente (compara com o separador da plataforma).
- Uploads usam `basename(info.filename)` + `uniqueName` (evita sobrescrita) antes de gravar.
- Downloads/exclusões resolvem o nome pela mesma função; fora do diretório → `400 invalid filename`.
- Nomes de arquivo no `Content-Disposition` têm fallback ASCII + `filename*` UTF-8.

## Validação de entrada

- Todo corpo de request é validado com **Zod** antes de tocar nos dados (ver
  [validação](../04-api/validacao-schemas.md)). Limites de tamanho (nome 120, anotação 2000, etc.).
- `readBody` faz `JSON.parse` tolerante; payload inválido → tratado como `undefined` → 400 na
  validação.

## Execução de comando do SO

- `POST /api/patients/:id/open-folder` chama `explorer.exe`/`open`/`xdg-open` com o **caminho do
  diretório do paciente** (derivado de dados internos, não de input bruto do usuário). O caminho é
  montado a partir do ID/slug do paciente, não de string arbitrária do request.

## Dados em repouso

- JSON em texto puro no disco, **sem criptografia**. A confidencialidade depende da segurança da
  máquina/SO do usuário (login do Windows, disco criptografado, etc.).
- `data/` é git-ignored — risco de vazamento por commit é mitigado.

## Recomendações operacionais

1. Trocar a senha padrão imediatamente.
2. Não expor a porta do dev-server na rede local/internet.
3. Usar disco com criptografia (BitLocker) na máquina que guarda `data/`.
4. Backups externos da pasta `data/` em meio também protegido.
5. Não commitar `data/` (já ignorado — não forçar com `git add -f`).

## Itens fora de escopo (não implementados)

- Rate limiting, CSRF, headers de segurança, auditoria de acesso.
- Criptografia de dados em repouso.
- Expiração/rotação de sessão.
- Autorização por papel (não há múltiplos usuários).
