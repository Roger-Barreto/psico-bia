#!/usr/bin/env node
/**
 * One-time migration script: data/*.json → Supabase.
 *
 * Usage:
 *   1. cp .env.migration.example .env.migration  (cria local)
 *   2. preencha SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_USER_ID
 *   3. node scripts/migrate-to-supabase.mjs
 *
 * Flags:
 *   --reset     trunca tabelas antes (gated por confirmação)
 *   --dry       roda sem inserir, só conta
 *
 * NUNCA commitar .env.migration — contém secret key (bypass RLS).
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, dirname, basename } from "node:path"
import { fileURLToPath } from "node:url"
import { createInterface } from "node:readline"

// ─── env loading (.env.migration) ──────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const ENV_PATH = join(ROOT, ".env.migration")
const DATA_DIR_RAW = process.env.DATA_DIR ?? "data"
const DATA_DIR = DATA_DIR_RAW.startsWith("/") || /^[A-Za-z]:/.test(DATA_DIR_RAW)
  ? DATA_DIR_RAW
  : join(ROOT, DATA_DIR_RAW)

function loadEnv(path) {
  if (!existsSync(path)) return
  const raw = readFileSync(path, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i)
    if (!m) continue
    const [, k, v] = m
    if (!(k in process.env)) {
      process.env[k] = v.replace(/^["']|["']$/g, "")
    }
  }
}
loadEnv(ENV_PATH)

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY
const SUPABASE_USER_ID = process.env.SUPABASE_USER_ID
const DOCS_BUCKET = "patient-documents"

if (!SUPABASE_URL || !SUPABASE_SECRET || !SUPABASE_USER_ID) {
  console.error(
    "ERRO: Defina SUPABASE_URL, SUPABASE_SECRET_KEY e SUPABASE_USER_ID em .env.migration",
  )
  process.exit(1)
}

const args = new Set(process.argv.slice(2))
const RESET = args.has("--reset")
const DRY = args.has("--dry")

const sb = createClient(SUPABASE_URL, SUPABASE_SECRET, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ─── helpers ──────────────────────────────────────────────────
function readJson(name) {
  const path = join(DATA_DIR, name)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf8"))
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

async function confirm(prompt) {
  if (process.env.MIGRATION_YES === "1") return true
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(prompt + " [yes/no] ", (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === "yes")
    })
  })
}

async function insertChunked(table, rows) {
  if (DRY) {
    console.log(`  [dry] ${table}: ${rows.length} rows`)
    return rows.length
  }
  let total = 0
  for (const batch of chunk(rows, 500)) {
    const { error } = await sb.from(table).insert(batch)
    if (error) {
      console.error(`  ✗ ${table}:`, error.message)
      throw error
    }
    total += batch.length
  }
  console.log(`  ✓ ${table}: ${total} rows`)
  return total
}

async function resetAll() {
  // Ordem reversa de FK; profile usa user_id como PK
  const plan = [
    { table: "patient_annotations", pk: "id" },
    { table: "appointments", pk: "id" },
    { table: "appointment_series", pk: "id" },
    { table: "individual_checklist", pk: "id" },
    { table: "shared_checklist", pk: "id" },
    { table: "patients", pk: "id" },
    { table: "discharge_reasons", pk: "id" },
    { table: "insurances", pk: "id" },
    {
      table: "profile",
      pk: "user_id",
      sentinel: "00000000-0000-0000-0000-000000000000",
    },
  ]
  for (const { table, pk, sentinel } of plan) {
    const { error } = await sb
      .from(table)
      .delete()
      .neq(pk, sentinel ?? "__never__")
    if (error) {
      console.error(`reset ${table}:`, error.message)
      throw error
    }
    console.log(`  ✓ reset ${table}`)
  }
}

// ─── mappers ──────────────────────────────────────────────────
function mapPatient(p, validInsuranceIds, validReasonIds) {
  return {
    id: p.id,
    name: p.name,
    gender: p.gender,
    birthdate: p.birthdate,
    avatar_id: typeof p.avatarId === "number" ? p.avatarId : 0,
    active: p.active ?? true,
    created_at: p.createdAt,
    consultation_value: p.consultationValue ?? 0,
    insurance_id:
      p.insuranceId && validInsuranceIds.has(p.insuranceId)
        ? p.insuranceId
        : null,
    individual_checklist_item_ids: p.individualChecklistItemIds ?? [],
    discharged_at: p.dischargedAt ?? null,
    discharge_reason_id:
      p.dischargeReasonId && validReasonIds.has(p.dischargeReasonId)
        ? p.dischargeReasonId
        : null,
  }
}

function mapSeries(s) {
  return {
    id: s.id,
    patient_id: s.patientId,
    start_date: s.startDate,
    time: s.time,
    frequency: s.frequency,
    end_date: s.endDate ?? null,
    created_at: s.createdAt,
  }
}

function mapAppointment(a) {
  return {
    id: a.id,
    series_id: a.seriesId,
    patient_id: a.patientId,
    date: a.date,
    origin_date: a.originDate,
    status: a.status,
    rescheduled_to: a.rescheduledTo ?? null,
    time: a.time ?? null,
    checked_item_ids: a.checkedItemIds ?? [],
    snapshot_item_ids: a.snapshotItemIds ?? [],
    notes: a.notes ?? null,
    updated_at: a.updatedAt,
    paid: a.paid ?? false,
    paid_value: a.paidValue ?? null,
    paid_at: a.paidAt ?? null,
  }
}

function mapInsurance(i) {
  return {
    id: i.id,
    name: i.name,
    active: i.active ?? true,
    default_value: i.defaultValue ?? 0,
    created_at: i.createdAt,
  }
}

function mapReason(r) {
  return {
    id: r.id,
    name: r.name,
    active: r.active ?? true,
    created_at: r.createdAt,
  }
}

function mapShared(s) {
  return {
    id: s.id,
    label: s.label,
    order: s.order,
    archived: s.archived ?? false,
  }
}

function mapIndividual(i) {
  return {
    id: i.id,
    patient_id: i.patientId,
    label: i.label,
    order: i.order,
    archived: i.archived ?? false,
  }
}

function mapAnnotation(a) {
  return {
    id: a.id,
    patient_id: a.patientId,
    text: a.text,
    created_at: a.createdAt,
  }
}

// ─── docs upload ──────────────────────────────────────────────
function listAllFilesRecursive(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listAllFilesRecursive(full).map((f) => join(entry, f)))
    } else {
      out.push(entry)
    }
  }
  return out
}

async function uploadDocs() {
  const docsDir = join(DATA_DIR, "patient-documents")
  if (!existsSync(docsDir)) {
    console.log("  (sem patient-documents/ — skip)")
    return 0
  }
  // patientFolders: ./{slug}-{patientId}/  OR  ./{patientId}/
  const folders = readdirSync(docsDir).filter((f) =>
    statSync(join(docsDir, f)).isDirectory(),
  )
  let count = 0
  for (const folder of folders) {
    // Extrai patientId: pega tudo depois do último prefixo p_…
    const match = folder.match(/(p_[A-Za-z0-9_-]+)$/)
    const patientId = match ? match[1] : folder
    const folderPath = join(docsDir, folder)
    for (const file of listAllFilesRecursive(folderPath)) {
      const localPath = join(folderPath, file)
      const remotePath = `${patientId}/${basename(file)}`
      const buf = readFileSync(localPath)
      if (DRY) {
        console.log(`  [dry] upload ${remotePath} (${buf.length} B)`)
      } else {
        const { error } = await sb.storage
          .from(DOCS_BUCKET)
          .upload(remotePath, buf, { upsert: false })
        if (error && !/duplicate/i.test(error.message)) {
          console.error(`  ✗ ${remotePath}:`, error.message)
          throw error
        }
        count++
        console.log(`  ✓ ${remotePath}`)
      }
    }
  }
  return count
}

// ─── run ──────────────────────────────────────────────────────
async function main() {
  console.log(`Supabase URL: ${SUPABASE_URL}`)
  console.log(`Auth user:    ${SUPABASE_USER_ID}`)
  console.log(`Data dir:     ${DATA_DIR}`)
  console.log(`Mode:         ${DRY ? "DRY-RUN" : "WRITE"}${RESET ? " + RESET" : ""}\n`)

  if (RESET && !DRY) {
    if (
      !(await confirm(
        "RESET vai TRUNCAR todas as tabelas (auth.users mantido). Confirma?",
      ))
    ) {
      console.log("Abortado.")
      process.exit(0)
    }
    console.log("Resetting tables...")
    await resetAll()
  }

  // 1) profile (from user.json)
  const user = readJson("user.json")
  if (user) {
    const profileRow = {
      user_id: SUPABASE_USER_ID,
      display_name: user.displayName ?? "Administrador",
      avatar_id: typeof user.avatarId === "number" ? user.avatarId : null,
    }
    if (!DRY) {
      const { error } = await sb
        .from("profile")
        .upsert(profileRow, { onConflict: "user_id" })
      if (error) throw error
    }
    console.log(`  ✓ profile`)
  }

  // 2) insurances
  const insurances = readJson("insurances.json") ?? []
  await insertChunked("insurances", insurances.map(mapInsurance))
  const validInsuranceIds = new Set(insurances.map((i) => i.id))

  // 3) discharge_reasons
  const reasons = readJson("discharge-reasons.json") ?? []
  await insertChunked("discharge_reasons", reasons.map(mapReason))
  const validReasonIds = new Set(reasons.map((r) => r.id))

  // 4) patients
  const patients = readJson("patients.json") ?? []
  await insertChunked(
    "patients",
    patients.map((p) => mapPatient(p, validInsuranceIds, validReasonIds)),
  )
  const validPatientIds = new Set(patients.map((p) => p.id))

  // 5) shared_checklist
  const shared = readJson("shared-checklist.json") ?? []
  await insertChunked("shared_checklist", shared.map(mapShared))

  // 6) individual_checklist (filtra FK órfãs)
  const individualRaw = readJson("individual-checklist.json") ?? []
  const individual = individualRaw.filter((i) => validPatientIds.has(i.patientId))
  if (individual.length !== individualRaw.length) {
    console.warn(`  ⚠ individual_checklist: ${individualRaw.length - individual.length} órfãos descartados`)
  }
  await insertChunked("individual_checklist", individual.map(mapIndividual))

  // 7) appointment_series (filtra FK órfãs)
  const seriesRaw = readJson("appointment-series.json") ?? []
  const series = seriesRaw.filter((s) => validPatientIds.has(s.patientId))
  if (series.length !== seriesRaw.length) {
    console.warn(`  ⚠ appointment_series: ${seriesRaw.length - series.length} órfãos descartados`)
  }
  await insertChunked("appointment_series", series.map(mapSeries))
  const validSeriesIds = new Set(series.map((s) => s.id))

  // 8) appointments (filtra FK órfãs em series E patient)
  const appointmentsRaw = readJson("appointments.json") ?? []
  const appointments = appointmentsRaw.filter(
    (a) => validSeriesIds.has(a.seriesId) && validPatientIds.has(a.patientId),
  )
  if (appointments.length !== appointmentsRaw.length) {
    console.warn(`  ⚠ appointments: ${appointmentsRaw.length - appointments.length} órfãos descartados`)
  }
  await insertChunked("appointments", appointments.map(mapAppointment))

  // 9) patient_annotations (filtra FK órfãs)
  const annotationsRaw = readJson("patient-annotations.json") ?? []
  const annotations = annotationsRaw.filter((a) => validPatientIds.has(a.patientId))
  if (annotations.length !== annotationsRaw.length) {
    console.warn(`  ⚠ patient_annotations: ${annotationsRaw.length - annotations.length} órfãos descartados`)
  }
  await insertChunked("patient_annotations", annotations.map(mapAnnotation))

  // 10) docs
  console.log("\nUploading documents...")
  const docCount = await uploadDocs()
  console.log(`  ✓ ${docCount} arquivos`)

  console.log("\nMigração concluída.")
}

main().catch((err) => {
  console.error("\nFALHA:", err?.message ?? err)
  process.exit(1)
})
