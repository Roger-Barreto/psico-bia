import { mkdir, open, readFile, rename, copyFile, readdir, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"

const DATA_DIR = join(process.cwd(), "data")
const BACKUP_DIR = join(DATA_DIR, ".backups")

const cache = new Map<string, unknown>()
const locks = new Map<string, Promise<unknown>>()

async function ensureDir(p: string) {
  if (!existsSync(p)) await mkdir(p, { recursive: true })
}

function filePath(name: string) {
  return join(DATA_DIR, `${name}.json`)
}

export async function load<T>(name: string, fallback: T): Promise<T> {
  if (cache.has(name)) return cache.get(name) as T
  await ensureDir(DATA_DIR)
  const fp = filePath(name)
  // Arquivo inexistente = primeira execução legítima → semeia fallback.
  if (!existsSync(fp)) {
    cache.set(name, fallback)
    await persist(name, fallback)
    return fallback
  }
  const raw = await readFile(fp, "utf8")
  // Arquivo existente porém vazio/só espaços = sintoma de truncamento
  // (ex.: crash/queda de energia sem fsync). NUNCA sobrescrever com fallback:
  // preserva uma cópia e falha alto para o operador restaurar do backup.
  if (raw.trim() === "") {
    await preserveSuspect(name, fp)
    throw new Error(
      `[db] ${name}.json está vazio (possível truncamento). ` +
        `Carregamento recusado para não destruir dados. ` +
        `Restaure de data/.backups/ com o servidor parado.`,
    )
  }
  try {
    const parsed = JSON.parse(raw) as T
    cache.set(name, parsed)
    return parsed
  } catch (err) {
    // JSON inválido: preserva cópia (sem renomear/remover o original) e aborta.
    await preserveSuspect(name, fp)
    console.error(`[db] ${name}.json ilegível; abortando para proteger dados`, err)
    throw new Error(
      `[db] ${name}.json contém JSON inválido. ` +
        `Carregamento recusado para não destruir dados. ` +
        `Restaure de data/.backups/ com o servidor parado.`,
    )
  }
}

/**
 * Salva uma cópia de um arquivo suspeito (vazio/ilegível) como
 * `<name>.<timestamp>.corrupt.json` SEM tocar no original. Usa copyFile
 * (não rename) para que uma falha aqui jamais remova o arquivo de dados.
 */
async function preserveSuspect(name: string, fp: string): Promise<void> {
  const corrupt = join(DATA_DIR, `${name}.${Date.now()}.corrupt.json`)
  try {
    await copyFile(fp, corrupt)
    console.error(`[db] cópia do suspeito salva em ${corrupt}`)
  } catch (e) {
    console.error(`[db] falha ao preservar cópia de ${name}.json:`, e)
  }
}

async function persist<T>(name: string, value: T): Promise<void> {
  await ensureDir(DATA_DIR)
  await backupOncePerDay(name)
  const fp = filePath(name)
  const tmp = `${fp}.${process.pid}.tmp`
  const serialized = JSON.stringify(value, null, 2)
  // Salvaguarda: nunca gravar conteúdo vazio sobre o arquivo de dados.
  if (serialized === undefined || serialized.trim() === "") {
    throw new Error(`[db] recusando persistir conteúdo vazio em ${name}.json`)
  }
  // Escrita durável: grava no tmp, faz fsync do arquivo (garante que os
  // bytes chegaram ao disco ANTES do rename) e depois renomeia atomicamente.
  // Sem o fsync, em NTFS o rename pode persistir antes dos dados após um
  // crash/queda de energia, deixando o arquivo final com 0 bytes.
  const fh = await open(tmp, "w")
  try {
    await fh.writeFile(serialized, "utf8")
    await fh.sync()
  } finally {
    await fh.close()
  }
  await rename(tmp, fp)
  // fsync do diretório torna a própria entrada do rename durável.
  // Nem todo sistema de arquivos/SO suporta — ignorar falha.
  try {
    const dh = await open(DATA_DIR, "r")
    try {
      await dh.sync()
    } finally {
      await dh.close()
    }
  } catch {
    /* fsync de diretório não suportado nesta plataforma */
  }
}

async function backupOncePerDay(name: string) {
  const fp = filePath(name)
  if (!existsSync(fp)) return
  const today = new Date().toISOString().slice(0, 10)
  const dir = join(BACKUP_DIR, today)
  await ensureDir(dir)
  const dest = join(dir, `${name}.json`)
  if (existsSync(dest)) return
  await copyFile(fp, dest).catch(() => {})
  rotateBackups().catch(() => {})
}

async function rotateBackups() {
  if (!existsSync(BACKUP_DIR)) return
  const entries = await readdir(BACKUP_DIR)
  if (entries.length <= 7) return
  const sorted = entries.sort()
  const old = sorted.slice(0, sorted.length - 7)
  for (const d of old) {
    const p = join(BACKUP_DIR, d)
    const s = await stat(p).catch(() => null)
    if (s?.isDirectory()) {
      await rmRecursive(p).catch(() => {})
    }
  }
}

async function rmRecursive(p: string) {
  const { rm } = await import("node:fs/promises")
  await rm(p, { recursive: true, force: true })
}

export async function update<T>(
  name: string,
  fallback: T,
  mutator: (current: T) => T | Promise<T>,
): Promise<T> {
  const prev = (locks.get(name) ?? Promise.resolve()) as Promise<unknown>
  const next = prev.then(async () => {
    const current = await load(name, fallback)
    const updated = await mutator(structuredClone(current))
    cache.set(name, updated)
    await persist(name, updated)
    return updated
  })
  locks.set(name, next)
  try {
    return (await next) as T
  } finally {
    if (locks.get(name) === next) locks.delete(name)
  }
}

export function bustCache(name?: string) {
  if (name) cache.delete(name)
  else cache.clear()
}

export function dataDir() {
  return DATA_DIR
}

export function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
