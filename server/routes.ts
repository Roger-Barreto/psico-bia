import type { IncomingMessage, ServerResponse } from "node:http"
import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { mkdir, readdir, rename as renameFs, rm, stat, unlink } from "node:fs/promises"
import { basename, join, resolve } from "node:path"
import { exec } from "node:child_process"
import { pipeline } from "node:stream/promises"
import busboy from "busboy"
import { nanoid } from "nanoid"
import { dataDir, load, slugifyName, update } from "./db"
import {
  appointmentBulkDeleteSchema,
  appointmentPatchSchema,
  appointmentSeriesCreateSchema,
  appointmentSeriesPatchSchema,
  appointmentUpsertSchema,
  checklistItemCreateSchema,
  checklistItemPatchSchema,
  checklistReorderSchema,
  dischargeReasonCreateSchema,
  dischargeReasonPatchSchema,
  dischargeSchema,
  individualChecklistItemCreateSchema,
  individualChecklistItemPatchSchema,
  individualChecklistReorderSchema,
  insuranceCreateSchema,
  insurancePatchSchema,
  loginSchema,
  passwordChangeSchema,
  patientAnnotationCreateSchema,
  patientCreateSchema,
  patientPatchSchema,
  profilePatchSchema,
} from "./schemas"
import {
  DEFAULT_USER,
  hashPassword,
  sanitizeUser,
  verifyPassword,
  type StoredUser,
} from "./auth"
import type { ZodSchema } from "zod"
import {
  randomMonsterAvatarId,
  stableMonsterAvatarId,
} from "../src/lib/monster-avatars"

type Json = unknown

interface Patient {
  id: string
  name: string
  gender: "male" | "female" | "other"
  avatarId: number
  birthdate: string
  individualChecklistItemIds: string[]
  active: boolean
  createdAt: string
  consultationValue: number
  insuranceId: string | null
  dischargedAt: string | null
  dischargeReasonId: string | null
}

interface AppointmentSeries {
  id: string
  patientId: string
  startDate: string
  time: string
  frequency: "weekly" | "biweekly" | "monthly" | null
  endDate: string | null
  createdAt: string
}

interface Insurance {
  id: string
  name: string
  active: boolean
  createdAt: string
  defaultValue: number
}

interface DischargeReason {
  id: string
  name: string
  active: boolean
  createdAt: string
}

interface SharedItem {
  id: string
  label: string
  order: number
  archived: boolean
}

interface IndividualItem extends SharedItem {
  patientId: string
}

interface Appointment {
  id: string
  seriesId: string
  patientId: string
  date: string
  originDate: string
  status: "scheduled" | "attended" | "missed" | "rescheduled" | "cancelled"
  rescheduledTo: string | null
  time: string | null
  checkedItemIds: string[]
  snapshotItemIds: string[]
  notes: string | null
  updatedAt: string
  paid: boolean
  paidValue: number | null
  paidAt: string | null
}

interface PatientAnnotation {
  id: string
  patientId: string
  text: string
  createdAt: string
}

function normalizeInsurance(i: Insurance): Insurance {
  return {
    ...i,
    defaultValue: i.defaultValue ?? 0,
  }
}

function normalizePatient(p: Patient): Patient {
  return {
    ...p,
    consultationValue: p.consultationValue ?? 0,
    insuranceId: p.insuranceId ?? null,
    dischargedAt: p.dischargedAt ?? null,
    dischargeReasonId: p.dischargeReasonId ?? null,
    avatarId: p.avatarId ?? stableMonsterAvatarId(p.id),
    individualChecklistItemIds: p.individualChecklistItemIds ?? [],
  }
}

function normalizeAppointment(a: Appointment): Appointment {
  return {
    ...a,
    // Legado: reagendamento antigo gravava status "rescheduled" com date já =
    // rescheduledTo. Coage para "scheduled" (preservando date/rescheduledTo) para
    // a sessão fluir pelo caminho normal e ser acionável na nova data.
    status: a.status === "rescheduled" ? "scheduled" : a.status,
    time: a.time ?? null,
    paid: a.paid ?? false,
    paidValue: a.paidValue ?? null,
    paidAt: a.paidAt ?? null,
  }
}

function normalizeSeries(s: AppointmentSeries): AppointmentSeries {
  return {
    ...s,
    endDate: s.endDate ?? null,
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function prevISODate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function send(res: ServerResponse, status: number, body: Json) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.end(JSON.stringify(body))
}

function bad(res: ServerResponse, msg: string, details?: unknown) {
  send(res, 400, { error: msg, details })
}

function notFound(res: ServerResponse) {
  send(res, 404, { error: "not found" })
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  if (!chunks.length) return undefined
  const raw = Buffer.concat(chunks).toString("utf8")
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function parse<T>(schema: ZodSchema<T>, body: unknown):
  | { ok: true; data: T }
  | { ok: false; details: unknown } {
  const r = schema.safeParse(body)
  if (!r.success) return { ok: false, details: r.error.format() }
  return { ok: true, data: r.data }
}

function id(prefix: string) {
  return `${prefix}_${nanoid(10)}`
}

// Permanent checklist deletion: erase every trace of an item id from past
// appointments so it reads as if it never existed (archive keeps history).
async function scrubItemFromAppointments(itemId: string) {
  await update<Appointment[]>(APPTS, [], (list) =>
    list.map((a) => {
      const checkedItemIds = a.checkedItemIds.filter((x) => x !== itemId)
      const snapshotItemIds = a.snapshotItemIds.filter((x) => x !== itemId)
      if (
        checkedItemIds.length === a.checkedItemIds.length &&
        snapshotItemIds.length === a.snapshotItemIds.length
      )
        return a
      return { ...a, checkedItemIds, snapshotItemIds }
    }),
  )
}

const USER = "user"
const PATIENTS = "patients"
const SHARED = "shared-checklist"
const INDIV = "individual-checklist"
const APPTS = "appointments"
const SERIES = "appointment-series"
const INSURANCES = "insurances"
const DISCHARGE_REASONS = "discharge-reasons"
const ANNOTATIONS = "patient-annotations"
const DOCS_ROOT = "patient-documents"

function patientFolderName(patientId: string, patientName: string | undefined): string {
  const slug = patientName ? slugifyName(patientName) : ""
  return slug ? `${slug}-${patientId}` : patientId
}

async function patientDocsDir(patientId: string): Promise<string> {
  const list = await load<Patient[]>(PATIENTS, [])
  const p = list.find((x) => x.id === patientId)
  return join(dataDir(), DOCS_ROOT, patientFolderName(patientId, p?.name))
}

let migrationPromise: Promise<void> | null = null
async function runPatientDocsMigration(): Promise<void> {
  const root = join(dataDir(), DOCS_ROOT)
  if (!existsSync(root)) return
  const list = await load<Patient[]>(PATIENTS, [])
  const byId = new Map(list.map((p) => [p.id, p.name]))
  const entries = await readdir(root).catch(() => [] as string[])
  for (const folder of entries) {
    if (folder.startsWith(".")) continue
    if (!byId.has(folder)) continue
    const want = patientFolderName(folder, byId.get(folder))
    if (want === folder) continue
    const from = join(root, folder)
    const to = join(root, want)
    if (existsSync(to)) continue
    try {
      await renameFs(from, to)
      console.log(`[migration] patient-documents: ${folder} → ${want}`)
    } catch (err) {
      console.error(`[migration] failed to rename ${folder}:`, err)
    }
  }
}
function ensureMigrations(): Promise<void> {
  if (!migrationPromise) migrationPromise = runPatientDocsMigration()
  return migrationPromise
}

function safeResolveInside(parent: string, child: string): string | null {
  const target = resolve(parent, basename(child))
  const parentResolved = resolve(parent)
  if (!target.startsWith(parentResolved + (process.platform === "win32" ? "\\" : "/")) && target !== parentResolved) {
    return null
  }
  return target
}

async function ensureDir(p: string) {
  if (!existsSync(p)) await mkdir(p, { recursive: true })
}

function uniqueName(dir: string, name: string): string {
  if (!existsSync(join(dir, name))) return name
  const dot = name.lastIndexOf(".")
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ""
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}-${i}${ext}`
    if (!existsSync(join(dir, candidate))) return candidate
  }
  return `${base}-${Date.now()}${ext}`
}

function openInExplorer(absPath: string) {
  const platform = process.platform
  if (platform === "win32") {
    exec(`explorer.exe "${absPath}"`)
  } else if (platform === "darwin") {
    exec(`open "${absPath}"`)
  } else {
    exec(`xdg-open "${absPath}"`)
  }
}

export async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const path = url.pathname
  const method = req.method ?? "GET"

  await ensureMigrations()

  // ─── USER PROFILE ────────────────────────────────────────
  if (path === "/api/login") {
    if (method === "POST") {
      const body = await readBody(req)
      const r = parse(loginSchema, body)
      if (!r.ok) return send(res, 401, { error: "Credenciais inválidas" })
      const user = await load<StoredUser>(USER, DEFAULT_USER)
      if (
        user.username !== r.data.username ||
        !verifyPassword(r.data.password, user.password)
      ) {
        return send(res, 401, { error: "Credenciais inválidas" })
      }
      return send(res, 200, sanitizeUser(user))
    }
  }

  if (path === "/api/me") {
    if (method === "GET") {
      const user = await load<StoredUser>(USER, DEFAULT_USER)
      return send(res, 200, sanitizeUser(user))
    }
    if (method === "PATCH") {
      const body = await readBody(req)
      const r = parse(profilePatchSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      const next = await update<StoredUser>(USER, DEFAULT_USER, (cur) => ({
        ...cur,
        ...(r.data.displayName !== undefined
          ? { displayName: r.data.displayName }
          : {}),
        ...(r.data.avatarId !== undefined ? { avatarId: r.data.avatarId } : {}),
      }))
      return send(res, 200, sanitizeUser(next))
    }
  }

  if (path === "/api/me/password") {
    if (method === "POST") {
      const body = await readBody(req)
      const r = parse(passwordChangeSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      let badCurrent = false
      await update<StoredUser>(USER, DEFAULT_USER, (cur) => {
        if (!verifyPassword(r.data.currentPassword, cur.password)) {
          badCurrent = true
          return cur
        }
        return { ...cur, password: hashPassword(r.data.newPassword) }
      })
      if (badCurrent) {
        return send(res, 400, { error: "current_password_invalid" })
      }
      return send(res, 200, { ok: true })
    }
  }

  // ─── PATIENTS ────────────────────────────────────────────
  if (path === "/api/patients") {
    if (method === "GET") {
      const list = await load<Patient[]>(PATIENTS, [])
      return send(res, 200, list.map(normalizePatient))
    }
    if (method === "POST") {
      const body = await readBody(req)
      const r = parse(patientCreateSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      const created: Patient = {
        id: id("p"),
        ...r.data,
        avatarId: r.data.avatarId ?? randomMonsterAvatarId(),
        createdAt: new Date().toISOString(),
      }
      await update<Patient[]>(PATIENTS, [], (list) => [...list, created])
      return send(res, 201, created)
    }
  }

  // ─── PATIENT DOCUMENTS ───────────────────────────────────
  const docsListMatch = path.match(/^\/api\/patients\/([^/]+)\/documents$/)
  if (docsListMatch) {
    const pid = docsListMatch[1]
    const dir = await patientDocsDir(pid)
    if (method === "GET") {
      if (!existsSync(dir)) return send(res, 200, [])
      const names = await readdir(dir)
      const items = await Promise.all(
        names.map(async (n) => {
          const s = await stat(join(dir, n))
          return {
            filename: n,
            size: s.size,
            modifiedAt: s.mtime.toISOString(),
          }
        }),
      )
      return send(res, 200, items.filter((it) => !it.filename.startsWith(".")))
    }
    if (method === "POST") {
      await ensureDir(dir)
      const ct = req.headers["content-type"] ?? ""
      if (!ct.toString().startsWith("multipart/")) {
        return bad(res, "expected multipart/form-data")
      }
      try {
        const saved = await new Promise<string>((resolveP, rejectP) => {
          const bb = busboy({ headers: req.headers, defParamCharset: "utf8" })
          let savedName: string | null = null
          const writes: Promise<void>[] = []
          bb.on("file", (_field, file, info) => {
            const safe = basename(info.filename || "arquivo")
            const final = uniqueName(dir, safe)
            const target = safeResolveInside(dir, final)
            if (!target) {
              file.resume()
              rejectP(new Error("invalid filename"))
              return
            }
            savedName = final
            writes.push(pipeline(file, createWriteStream(target)))
          })
          bb.on("error", rejectP)
          bb.on("close", async () => {
            try {
              await Promise.all(writes)
              if (!savedName) return rejectP(new Error("no file in upload"))
              resolveP(savedName)
            } catch (err) {
              rejectP(err instanceof Error ? err : new Error(String(err)))
            }
          })
          req.pipe(bb)
        })
        const s = await stat(join(dir, saved))
        return send(res, 201, {
          filename: saved,
          size: s.size,
          modifiedAt: s.mtime.toISOString(),
        })
      } catch (err) {
        return bad(res, err instanceof Error ? err.message : "upload failed")
      }
    }
  }

  const docFileMatch = path.match(/^\/api\/patients\/([^/]+)\/documents\/(.+)$/)
  if (docFileMatch) {
    const pid = docFileMatch[1]
    const rawName = decodeURIComponent(docFileMatch[2])
    const dir = await patientDocsDir(pid)
    const target = safeResolveInside(dir, rawName)
    if (!target) return bad(res, "invalid filename")
    if (method === "GET") {
      if (!existsSync(target)) return notFound(res)
      const s = await stat(target)
      const name = basename(target)
      const asciiFallback = name.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "")
      res.statusCode = 200
      res.setHeader("Content-Type", "application/octet-stream")
      res.setHeader("Content-Length", String(s.size))
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      )
      createReadStream(target).pipe(res)
      return
    }
    if (method === "DELETE") {
      if (!existsSync(target)) return notFound(res)
      await unlink(target)
      return send(res, 200, { ok: true })
    }
  }

  const openFolderMatch = path.match(/^\/api\/patients\/([^/]+)\/open-folder$/)
  if (openFolderMatch && method === "POST") {
    const pid = openFolderMatch[1]
    const dir = await patientDocsDir(pid)
    await ensureDir(dir)
    openInExplorer(dir)
    return send(res, 200, { ok: true, path: dir })
  }

  // ─── DISCHARGE ───────────────────────────────────────────
  const dischargeMatch = path.match(/^\/api\/patients\/([^/]+)\/discharge$/)
  if (dischargeMatch && method === "POST") {
    const pid = dischargeMatch[1]
    const body = await readBody(req)
    const r = parse(dischargeSchema, body)
    if (!r.ok) return bad(res, "invalid payload", r.details)
    const { dischargedAt, dischargeReasonId } = r.data
    let updated: Patient | null = null
    await update<Patient[]>(PATIENTS, [], (list) =>
      list.map((p) => {
        if (p.id !== pid) return p
        updated = { ...p, dischargedAt, dischargeReasonId }
        return updated
      }),
    )
    if (!updated) return notFound(res)
    await update<AppointmentSeries[]>(SERIES, [], (list) =>
      list.map((s) => {
        if (s.patientId !== pid) return s
        if (s.endDate === null || s.endDate > dischargedAt) {
          return { ...s, endDate: dischargedAt }
        }
        return s
      }),
    )
    let deletedAppointments = 0
    await update<Appointment[]>(APPTS, [], (list) =>
      list.filter((a) => {
        if (a.patientId !== pid) return true
        if (a.date <= dischargedAt) return true
        if (a.status === "scheduled" || a.status === "rescheduled") {
          deletedAppointments++
          return false
        }
        return true
      }),
    )
    return send(res, 200, { patient: updated, deletedAppointments })
  }

  const reopenMatch = path.match(/^\/api\/patients\/([^/]+)\/reopen$/)
  if (reopenMatch && method === "POST") {
    const pid = reopenMatch[1]
    let updated: Patient | null = null
    await update<Patient[]>(PATIENTS, [], (list) =>
      list.map((p) => {
        if (p.id !== pid) return p
        updated = { ...p, dischargedAt: null, dischargeReasonId: null }
        return updated
      }),
    )
    if (!updated) return notFound(res)
    return send(res, 200, updated)
  }

  // ─── HARD DELETE ─────────────────────────────────────────
  const permanentMatch = path.match(/^\/api\/patients\/([^/]+)\/permanent$/)
  if (permanentMatch && method === "DELETE") {
    const pid = permanentMatch[1]
    let removed: Patient | null = null
    let patientName: string | undefined
    await update<Patient[]>(PATIENTS, [], (list) =>
      list.filter((p) => {
        if (p.id === pid) {
          removed = p
          patientName = p.name
          return false
        }
        return true
      }),
    )
    if (!removed) return notFound(res)
    await update<AppointmentSeries[]>(SERIES, [], (list) =>
      list.filter((s) => s.patientId !== pid),
    )
    await update<Appointment[]>(APPTS, [], (list) =>
      list.filter((a) => a.patientId !== pid),
    )
    await update<PatientAnnotation[]>(ANNOTATIONS, [], (list) =>
      list.filter((n) => n.patientId !== pid),
    )
    await update<IndividualItem[]>(INDIV, [], (list) =>
      list.filter((it) => it.patientId !== pid),
    )
    const docsDir = join(
      dataDir(),
      DOCS_ROOT,
      patientFolderName(pid, patientName),
    )
    if (existsSync(docsDir)) {
      try {
        await rm(docsDir, { recursive: true, force: true })
      } catch (err) {
        console.error(`[patient-docs] failed to remove ${docsDir}:`, err)
      }
    }
    return send(res, 200, { ok: true })
  }

  const patientIdMatch = path.match(/^\/api\/patients\/([^/]+)$/)
  if (patientIdMatch) {
    const pid = patientIdMatch[1]
    if (method === "PATCH") {
      const body = await readBody(req)
      const r = parse(patientPatchSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      let updated: Patient | null = null
      let prevName: string | null = null
      await update<Patient[]>(PATIENTS, [], (list) =>
        list.map((p) => {
          if (p.id !== pid) return p
          const prev = normalizePatient(p)
          prevName = prev.name
          const merged: Patient = { ...prev, ...r.data }
          updated = merged
          return updated
        }),
      )
      if (!updated) return notFound(res)
      const updatedPatient = updated as Patient
      if (prevName !== null && prevName !== updatedPatient.name) {
        const root = join(dataDir(), DOCS_ROOT)
        const oldDir = join(root, patientFolderName(pid, prevName))
        const newDir = join(root, patientFolderName(pid, updatedPatient.name))
        if (existsSync(oldDir) && oldDir !== newDir && !existsSync(newDir)) {
          try {
            await renameFs(oldDir, newDir)
          } catch (err) {
            console.error(`[patient-docs] failed to rename folder for ${pid}:`, err)
          }
        }
      }
      return send(res, 200, updatedPatient)
    }
    if (method === "DELETE") {
      let removed: Patient | null = null
      await update<Patient[]>(PATIENTS, [], (list) =>
        list.map((p) => {
          if (p.id !== pid) return p
          removed = { ...p, active: false }
          return removed
        }),
      )
      if (!removed) return notFound(res)
      return send(res, 200, removed)
    }
  }

  // ─── SHARED CHECKLIST ────────────────────────────────────
  if (path === "/api/shared-checklist") {
    if (method === "GET") {
      const list = await load<SharedItem[]>(SHARED, [])
      return send(res, 200, list)
    }
    if (method === "POST") {
      const body = await readBody(req)
      const r = parse(checklistItemCreateSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      const item: SharedItem = { id: id("sc"), ...r.data }
      await update<SharedItem[]>(SHARED, [], (list) => [...list, item])
      return send(res, 201, item)
    }
  }

  if (path === "/api/shared-checklist/reorder" && method === "PATCH") {
    const body = await readBody(req)
    const r = parse(checklistReorderSchema, body)
    if (!r.ok) return bad(res, "invalid payload", r.details)
    const orderById = new Map(r.data.ids.map((itemId, i) => [itemId, i]))
    const out = await update<SharedItem[]>(SHARED, [], (list) =>
      list.map((it) =>
        orderById.has(it.id) ? { ...it, order: orderById.get(it.id)! } : it,
      ),
    )
    return send(res, 200, out)
  }

  const sharedPermMatch = path.match(
    /^\/api\/shared-checklist\/([^/]+)\/permanent$/,
  )
  if (sharedPermMatch && method === "DELETE") {
    const sid = sharedPermMatch[1]
    let found = false
    await update<SharedItem[]>(SHARED, [], (list) =>
      list.filter((it) => {
        if (it.id === sid) {
          found = true
          return false
        }
        return true
      }),
    )
    if (!found) return notFound(res)
    await scrubItemFromAppointments(sid)
    return send(res, 200, { ok: true })
  }

  const sharedIdMatch = path.match(/^\/api\/shared-checklist\/([^/]+)$/)
  if (sharedIdMatch) {
    const sid = sharedIdMatch[1]
    if (method === "PATCH") {
      const body = await readBody(req)
      const r = parse(checklistItemPatchSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      let updated: SharedItem | null = null
      await update<SharedItem[]>(SHARED, [], (list) =>
        list.map((it) => {
          if (it.id !== sid) return it
          updated = { ...it, ...r.data }
          return updated
        }),
      )
      if (!updated) return notFound(res)
      return send(res, 200, updated)
    }
    if (method === "DELETE") {
      let archived: SharedItem | null = null
      await update<SharedItem[]>(SHARED, [], (list) =>
        list.map((it) => {
          if (it.id !== sid) return it
          archived = { ...it, archived: true }
          return archived
        }),
      )
      if (!archived) return notFound(res)
      return send(res, 200, archived)
    }
  }

  // ─── INDIVIDUAL CHECKLIST ────────────────────────────────
  if (path === "/api/individual-checklist") {
    if (method === "GET") {
      const patientId = url.searchParams.get("patientId")
      const list = await load<IndividualItem[]>(INDIV, [])
      return send(
        res,
        200,
        patientId ? list.filter((it) => it.patientId === patientId) : list,
      )
    }
    if (method === "POST") {
      const body = await readBody(req)
      const r = parse(individualChecklistItemCreateSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      const item: IndividualItem = { id: id("ci"), ...r.data }
      await update<IndividualItem[]>(INDIV, [], (list) => [...list, item])
      return send(res, 201, item)
    }
  }

  if (path === "/api/individual-checklist/reorder" && method === "PATCH") {
    const body = await readBody(req)
    const r = parse(individualChecklistReorderSchema, body)
    if (!r.ok) return bad(res, "invalid payload", r.details)
    const orderById = new Map(r.data.ids.map((itemId, i) => [itemId, i]))
    const out = await update<IndividualItem[]>(INDIV, [], (list) =>
      list.map((it) =>
        it.patientId === r.data.patientId && orderById.has(it.id)
          ? { ...it, order: orderById.get(it.id)! }
          : it,
      ),
    )
    return send(
      res,
      200,
      out.filter((it) => it.patientId === r.data.patientId),
    )
  }

  const indivPermMatch = path.match(
    /^\/api\/individual-checklist\/([^/]+)\/permanent$/,
  )
  if (indivPermMatch && method === "DELETE") {
    const iid = indivPermMatch[1]
    let found = false
    await update<IndividualItem[]>(INDIV, [], (list) =>
      list.filter((it) => {
        if (it.id === iid) {
          found = true
          return false
        }
        return true
      }),
    )
    if (!found) return notFound(res)
    await scrubItemFromAppointments(iid)
    await update<Patient[]>(PATIENTS, [], (list) =>
      list.map((p) =>
        p.individualChecklistItemIds?.includes(iid)
          ? {
              ...p,
              individualChecklistItemIds: p.individualChecklistItemIds.filter(
                (x) => x !== iid,
              ),
            }
          : p,
      ),
    )
    return send(res, 200, { ok: true })
  }

  const indivIdMatch = path.match(/^\/api\/individual-checklist\/([^/]+)$/)
  if (indivIdMatch) {
    const iid = indivIdMatch[1]
    if (method === "PATCH") {
      const body = await readBody(req)
      const r = parse(individualChecklistItemPatchSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      let updated: IndividualItem | null = null
      await update<IndividualItem[]>(INDIV, [], (list) =>
        list.map((it) => {
          if (it.id !== iid) return it
          updated = { ...it, ...r.data }
          return updated
        }),
      )
      if (!updated) return notFound(res)
      return send(res, 200, updated)
    }
    if (method === "DELETE") {
      let archived: IndividualItem | null = null
      await update<IndividualItem[]>(INDIV, [], (list) =>
        list.map((it) => {
          if (it.id !== iid) return it
          archived = { ...it, archived: true }
          return archived
        }),
      )
      if (!archived) return notFound(res)
      return send(res, 200, archived)
    }
  }

  // ─── APPOINTMENT SERIES ──────────────────────────────────
  if (path === "/api/appointment-series") {
    if (method === "GET") {
      const patientId = url.searchParams.get("patientId")
      const list = await load<AppointmentSeries[]>(SERIES, [])
      const out = list.map(normalizeSeries)
      return send(
        res,
        200,
        patientId ? out.filter((s) => s.patientId === patientId) : out,
      )
    }
    if (method === "POST") {
      const body = await readBody(req)
      const r = parse(appointmentSeriesCreateSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      const created: AppointmentSeries = {
        id: id("as"),
        patientId: r.data.patientId,
        startDate: r.data.startDate,
        time: r.data.time,
        frequency: r.data.frequency,
        endDate: r.data.endDate ?? null,
        createdAt: new Date().toISOString(),
      }
      await update<AppointmentSeries[]>(SERIES, [], (list) => [...list, created])
      return send(res, 201, created)
    }
  }

  const seriesIdMatch = path.match(/^\/api\/appointment-series\/([^/]+)$/)
  if (seriesIdMatch) {
    const sid = seriesIdMatch[1]
    if (method === "PATCH") {
      const body = await readBody(req)
      const r = parse(appointmentSeriesPatchSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      let updated: AppointmentSeries | null = null
      await update<AppointmentSeries[]>(SERIES, [], (list) =>
        list.map((s) => {
          if (s.id !== sid) return s
          updated = { ...s, ...r.data }
          return updated
        }),
      )
      if (!updated) return notFound(res)
      return send(res, 200, updated)
    }
    if (method === "DELETE") {
      let removed: AppointmentSeries | null = null
      await update<AppointmentSeries[]>(SERIES, [], (list) =>
        list.filter((s) => {
          if (s.id === sid) {
            removed = s
            return false
          }
          return true
        }),
      )
      if (!removed) return notFound(res)
      await update<Appointment[]>(APPTS, [], (list) =>
        list.filter((a) => a.seriesId !== sid),
      )
      return send(res, 200, removed)
    }
  }

  // ─── APPOINTMENTS BULK DELETE (undo) ─────────────────────
  if (path === "/api/appointments/bulk-delete" && method === "POST") {
    const body = await readBody(req)
    const r = parse(appointmentBulkDeleteSchema, body)
    if (!r.ok) return bad(res, "invalid payload", r.details)
    const { seriesId, scope, originDate } = r.data

    const seriesList = await load<AppointmentSeries[]>(SERIES, [])
    const series = seriesList.find((s) => s.id === seriesId)
    if (!series) return notFound(res)

    let removedCount = 0
    let cancelledCount = 0
    let seriesDeleted = false
    const now = new Date().toISOString()

    async function deleteEntireSeries() {
      await update<AppointmentSeries[]>(SERIES, [], (list) =>
        list.filter((s) => s.id !== seriesId),
      )
      await update<Appointment[]>(APPTS, [], (list) =>
        list.filter((a) => {
          if (a.seriesId !== seriesId) return true
          removedCount++
          return false
        }),
      )
      seriesDeleted = true
    }

    if (scope === "all") {
      await deleteEntireSeries()
    } else if (scope === "one") {
      if (series.frequency === null) {
        await deleteEntireSeries()
      } else {
        const origin = originDate as string
        await update<Appointment[]>(APPTS, [], (list) => {
          const idx = list.findIndex(
            (a) => a.seriesId === seriesId && a.originDate === origin,
          )
          if (idx === -1) {
            const created: Appointment = {
              id: id("ap"),
              seriesId,
              patientId: series.patientId,
              date: origin,
              originDate: origin,
              status: "cancelled",
              rescheduledTo: null,
              time: null,
              checkedItemIds: [],
              snapshotItemIds: [],
              notes: null,
              updatedAt: now,
              paid: false,
              paidValue: null,
              paidAt: null,
            }
            cancelledCount++
            return [...list, created]
          }
          const prev = normalizeAppointment(list[idx])
          const next: Appointment = {
            ...prev,
            status: "cancelled",
            rescheduledTo: null,
            checkedItemIds: [],
            snapshotItemIds: [],
            notes: null,
            paid: false,
            paidValue: null,
            paidAt: null,
            updatedAt: now,
          }
          cancelledCount++
          const copy = list.slice()
          copy[idx] = next
          return copy
        })
      }
    } else {
      // scope === "future"
      const origin = originDate as string
      const newEnd = prevISODate(origin)
      if (newEnd < series.startDate) {
        await deleteEntireSeries()
      } else {
        await update<AppointmentSeries[]>(SERIES, [], (list) =>
          list.map((s) =>
            s.id === seriesId ? { ...s, endDate: newEnd } : s,
          ),
        )
        await update<Appointment[]>(APPTS, [], (list) =>
          list.filter((a) => {
            if (a.seriesId !== seriesId) return true
            if (a.originDate >= origin) {
              removedCount++
              return false
            }
            return true
          }),
        )
      }
    }

    return send(res, 200, {
      ok: true,
      removedCount,
      cancelledCount,
      seriesDeleted,
    })
  }

  // ─── APPOINTMENTS ────────────────────────────────────────
  if (path === "/api/appointments") {
    if (method === "GET") {
      const from = url.searchParams.get("from")
      const to = url.searchParams.get("to")
      const patientId = url.searchParams.get("patientId")
      const list = await load<Appointment[]>(APPTS, [])
      let out = list.map(normalizeAppointment)
      if (from) out = out.filter((a) => a.date >= from)
      if (to) out = out.filter((a) => a.date <= to)
      if (patientId) out = out.filter((a) => a.patientId === patientId)
      return send(res, 200, out)
    }
    if (method === "POST") {
      const body = await readBody(req)
      const r = parse(appointmentUpsertSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      const input = r.data
      const now = new Date().toISOString()
      let result: Appointment | null = null
      await update<Appointment[]>(APPTS, [], (list) => {
        const idx = list.findIndex(
          (a) =>
            a.seriesId === input.seriesId &&
            a.originDate === input.originDate,
        )
        if (idx === -1) {
          const created: Appointment = {
            id: id("ap"),
            seriesId: input.seriesId,
            patientId: input.patientId,
            originDate: input.originDate,
            date: input.date ?? input.originDate,
            status: input.status,
            rescheduledTo: input.rescheduledTo ?? null,
            time: input.time ?? null,
            checkedItemIds: input.checkedItemIds ?? [],
            snapshotItemIds: input.snapshotItemIds ?? [],
            notes: input.notes ?? null,
            updatedAt: now,
            paid: input.paid ?? false,
            paidValue: input.paidValue ?? null,
            paidAt: input.paidAt ?? null,
          }
          result = created
          return [...list, created]
        }
        const prev = normalizeAppointment(list[idx])
        const merged: Appointment = {
          ...prev,
          date: input.date ?? prev.date,
          status: input.status,
          rescheduledTo:
            input.rescheduledTo === undefined
              ? prev.rescheduledTo
              : input.rescheduledTo,
          time: input.time === undefined ? prev.time : input.time,
          checkedItemIds: input.checkedItemIds ?? prev.checkedItemIds,
          snapshotItemIds: input.snapshotItemIds ?? prev.snapshotItemIds,
          notes: input.notes === undefined ? prev.notes : input.notes,
          updatedAt: now,
          paid: input.paid === undefined ? prev.paid : input.paid,
          paidValue:
            input.paidValue === undefined ? prev.paidValue : input.paidValue,
          paidAt: input.paidAt === undefined ? prev.paidAt : input.paidAt,
        }
        result = merged
        const next = [...list]
        next[idx] = merged
        return next
      })
      return send(res, 200, result)
    }
  }

  const apptIdMatch = path.match(/^\/api\/appointments\/([^/]+)$/)
  if (apptIdMatch) {
    const aid = apptIdMatch[1]
    if (method === "PATCH") {
      const body = await readBody(req)
      const r = parse(appointmentPatchSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      const now = new Date().toISOString()
      let updated: Appointment | null = null
      await update<Appointment[]>(APPTS, [], (list) =>
        list.map((a) => {
          if (a.id !== aid) return a
          updated = { ...a, ...r.data, updatedAt: now }
          return updated
        }),
      )
      if (!updated) return notFound(res)
      return send(res, 200, updated)
    }
    if (method === "DELETE") {
      let removed: Appointment | null = null
      await update<Appointment[]>(APPTS, [], (list) =>
        list.filter((a) => {
          if (a.id === aid) {
            removed = a
            return false
          }
          return true
        }),
      )
      if (!removed) return notFound(res)
      return send(res, 200, removed)
    }
  }

  // ─── INSURANCES ──────────────────────────────────────────
  if (path === "/api/insurances") {
    if (method === "GET") {
      const list = await load<Insurance[]>(INSURANCES, [])
      return send(res, 200, list.map(normalizeInsurance))
    }
    if (method === "POST") {
      const body = await readBody(req)
      const r = parse(insuranceCreateSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      const created: Insurance = {
        id: id("ins"),
        ...r.data,
        createdAt: new Date().toISOString(),
      }
      await update<Insurance[]>(INSURANCES, [], (list) => [...list, created])
      return send(res, 201, created)
    }
  }

  const insIdMatch = path.match(/^\/api\/insurances\/([^/]+)$/)
  if (insIdMatch) {
    const insId = insIdMatch[1]
    if (method === "PATCH") {
      const body = await readBody(req)
      const r = parse(insurancePatchSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      let updated: Insurance | null = null
      await update<Insurance[]>(INSURANCES, [], (list) =>
        list.map((it) => {
          if (it.id !== insId) return it
          updated = { ...it, ...r.data }
          return updated
        }),
      )
      if (!updated) return notFound(res)
      return send(res, 200, updated)
    }
    if (method === "DELETE") {
      let archived: Insurance | null = null
      await update<Insurance[]>(INSURANCES, [], (list) =>
        list.map((it) => {
          if (it.id !== insId) return it
          archived = { ...it, active: false }
          return archived
        }),
      )
      if (!archived) return notFound(res)
      return send(res, 200, archived)
    }
  }

  // ─── DISCHARGE REASONS ───────────────────────────────────
  if (path === "/api/discharge-reasons") {
    if (method === "GET") {
      const list = await load<DischargeReason[]>(DISCHARGE_REASONS, [])
      return send(res, 200, list)
    }
    if (method === "POST") {
      const body = await readBody(req)
      const r = parse(dischargeReasonCreateSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      const created: DischargeReason = {
        id: id("dr"),
        ...r.data,
        createdAt: new Date().toISOString(),
      }
      await update<DischargeReason[]>(DISCHARGE_REASONS, [], (list) => [
        ...list,
        created,
      ])
      return send(res, 201, created)
    }
  }

  const drIdMatch = path.match(/^\/api\/discharge-reasons\/([^/]+)$/)
  if (drIdMatch) {
    const drId = drIdMatch[1]
    if (method === "PATCH") {
      const body = await readBody(req)
      const r = parse(dischargeReasonPatchSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      let updated: DischargeReason | null = null
      await update<DischargeReason[]>(DISCHARGE_REASONS, [], (list) =>
        list.map((it) => {
          if (it.id !== drId) return it
          updated = { ...it, ...r.data }
          return updated
        }),
      )
      if (!updated) return notFound(res)
      return send(res, 200, updated)
    }
    if (method === "DELETE") {
      let archived: DischargeReason | null = null
      await update<DischargeReason[]>(DISCHARGE_REASONS, [], (list) =>
        list.map((it) => {
          if (it.id !== drId) return it
          archived = { ...it, active: false }
          return archived
        }),
      )
      if (!archived) return notFound(res)
      return send(res, 200, archived)
    }
  }

  // ─── PATIENT ANNOTATIONS ─────────────────────────────────
  if (path === "/api/patient-annotations") {
    if (method === "GET") {
      const patientId = url.searchParams.get("patientId")
      const list = await load<PatientAnnotation[]>(ANNOTATIONS, [])
      const filtered = patientId
        ? list.filter((it) => it.patientId === patientId)
        : list
      const sorted = filtered
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      return send(res, 200, sorted)
    }
    if (method === "POST") {
      const body = await readBody(req)
      const r = parse(patientAnnotationCreateSchema, body)
      if (!r.ok) return bad(res, "invalid payload", r.details)
      const created: PatientAnnotation = {
        id: id("an"),
        ...r.data,
        createdAt: new Date().toISOString(),
      }
      await update<PatientAnnotation[]>(ANNOTATIONS, [], (list) => [
        ...list,
        created,
      ])
      return send(res, 201, created)
    }
  }

  const annotationIdMatch = path.match(/^\/api\/patient-annotations\/([^/]+)$/)
  if (annotationIdMatch) {
    const anId = annotationIdMatch[1]
    if (method === "DELETE") {
      let removed: PatientAnnotation | null = null
      await update<PatientAnnotation[]>(ANNOTATIONS, [], (list) =>
        list.filter((it) => {
          if (it.id === anId) {
            removed = it
            return false
          }
          return true
        }),
      )
      if (!removed) return notFound(res)
      return send(res, 200, removed)
    }
  }

  notFound(res)
}
