import { mkdir, readFile, rename, writeFile, copyFile, readdir, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"

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
  if (!existsSync(fp)) {
    cache.set(name, fallback)
    await persist(name, fallback)
    return fallback
  }
  try {
    const raw = await readFile(fp, "utf8")
    const parsed = JSON.parse(raw) as T
    cache.set(name, parsed)
    return parsed
  } catch (err) {
    const corrupt = join(DATA_DIR, `${name}.${Date.now()}.corrupt.json`)
    await rename(fp, corrupt).catch(() => {})
    console.error(`[db] corrupt ${name}.json moved to ${corrupt}`, err)
    cache.set(name, fallback)
    await persist(name, fallback)
    return fallback
  }
}

async function persist<T>(name: string, value: T): Promise<void> {
  await ensureDir(DATA_DIR)
  await backupOncePerDay(name)
  const fp = filePath(name)
  const tmp = `${fp}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), "utf8")
  await rename(tmp, fp)
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
