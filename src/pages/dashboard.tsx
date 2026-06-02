import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type {
  AppointmentSeries,
  DischargeReason,
  Insurance,
  Occurrence,
  Patient,
} from "@/db/types"
import { PatientDrawer } from "@/components/patient/patient-drawer"
import {
  useAppointmentSeries,
  useAppointmentsInRange,
  useDischargeReasons,
  useInsurances,
  usePatients,
} from "@/api/queries"
import { pendencyBreakdown } from "@/domain/pendencies"
import {
  endOfMonth,
  startOfMonth,
  toISO,
  todayISO,
} from "@/domain/dates"
import { effectiveValue } from "@/domain/finance"
import { occurrencesForPatient } from "@/domain/recurrence"
import { MonthSelector } from "@/components/dashboard/month-selector"
import { PendencyBlock } from "@/components/dashboard/pendency-block"
import { PriorPendenciesBanner } from "@/components/dashboard/prior-pendencies-banner"
import { KpiCard } from "@/components/dashboard/kpi-card"
import {
  CategoryPie,
  ChartCard,
  MonthlyRevenueChart,
  RevenueByDayChart,
  TopPatientsChart,
} from "@/components/dashboard/charts"
import {
  PendencyList,
  type PendencyBreakdown,
} from "@/components/dashboard/pendency-list"
import { FinancialGauge } from "@/components/dashboard/financial-gauge"
import {
  UnpaidPatientsDialog,
  type UnpaidPatientEntry,
} from "@/components/dashboard/unpaid-patients-dialog"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { DashboardSkeleton } from "@/components/dashboard/skeletons"

function monthRangeISO(year: number, month: number): { from: string; to: string } {
  const d = new Date(year, month - 1, 1)
  return { from: toISO(startOfMonth(d)), to: toISO(endOfMonth(d)) }
}

function previousMonths(
  year: number,
  month: number,
  count: number,
): Array<{ year: number; month: number; label: string }> {
  const out: Array<{ year: number; month: number; label: string }> = []
  for (let i = count - 1; i >= 0; i--) {
    let m = month - i
    let y = year
    while (m < 1) {
      m += 12
      y -= 1
    }
    out.push({
      year: y,
      month: m,
      label: `${String(m).padStart(2, "0")}/${String(y).slice(2)}`,
    })
  }
  return out
}

export function DashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const today = todayISO()
  const monthIndex = year * 12 + month
  const prevMonthIndex = useRef(monthIndex)
  const slideDir = monthIndex >= prevMonthIndex.current ? 1 : -1
  useEffect(() => {
    prevMonthIndex.current = monthIndex
  }, [monthIndex])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unpaidOpen, setUnpaidOpen] = useState(false)
  const [activeKey, setActiveKey] = useState<{
    seriesId: string
    patientId: string
    originDate: string
  } | null>(null)

  const { from, to } = monthRangeISO(year, month)
  const apptsQ = useAppointmentsInRange(from, to)
  const patientsQ = usePatients()
  const seriesQ = useAppointmentSeries()
  const insurancesQ = useInsurances()
  const reasonsQ = useDischargeReasons()

  const longRangeStart = useMemo(() => {
    let m = month - 11
    let y = year
    while (m < 1) {
      m += 12
      y -= 1
    }
    return toISO(startOfMonth(new Date(y, m - 1, 1)))
  }, [year, month])
  const longRangeEnd = useMemo(
    () => toISO(endOfMonth(new Date(year, month - 1, 1))),
    [year, month],
  )
  const longRangeApptsQ = useAppointmentsInRange(longRangeStart, longRangeEnd)

  const allPatients = patientsQ.data ?? []
  const insurances = insurancesQ.data ?? []
  const reasons = reasonsQ.data ?? []
  const allAppts = apptsQ.data ?? []
  const allSeries = seriesQ.data ?? []

  const seriesById = useMemo(() => {
    const m = new Map<string, AppointmentSeries>()
    for (const s of allSeries) m.set(s.id, s)
    return m
  }, [allSeries])

  // Active patients = active=true (includes discharged for historical metrics)
  const patients = useMemo(
    () => allPatients.filter((p) => p.active),
    [allPatients],
  )
  const patientsById = useMemo(() => {
    const m = new Map<string, Patient>()
    for (const p of patients) m.set(p.id, p)
    return m
  }, [patients])

  // Filter out appointments for archived patients
  const appts = useMemo(
    () => allAppts.filter((a) => patientsById.has(a.patientId)),
    [allAppts, patientsById],
  )

  // Ocorrências do mês (mesma fonte da agenda) → pendências unificadas.
  const monthOccurrences = useMemo(() => {
    const range = { fromISO: from, toISO: to }
    const out: Occurrence[] = []
    for (const p of patients) {
      for (const o of occurrencesForPatient(p, allSeries, range, appts)) {
        const b = pendencyBreakdown(o, today)
        o.pendencyCount = b.checklist + b.overdue
        out.push(o)
      }
    }
    return out
  }, [patients, allSeries, appts, from, to, today])

  // ── Pendency totals (item-level) ─────────────────────────
  const pendencyStats = useMemo(() => {
    let total = 0
    let overdue = 0
    let todayN = 0
    for (const o of monthOccurrences) {
      const sum = o.pendencyCount
      if (sum === 0) continue
      total += sum
      if (o.date < today) overdue += sum
      else todayN += sum
    }
    return { total, overdue, today: todayN }
  }, [monthOccurrences, today])

  // ── Pendency by patient (cards) ──────────────────────────
  const pendencyByPatient = useMemo<PendencyBreakdown[]>(() => {
    const map = new Map<string, PendencyBreakdown>()
    for (const o of monthOccurrences) {
      if (o.pendencyCount === 0) continue
      const patient = patientsById.get(o.patientId)
      if (!patient) continue
      const b = pendencyBreakdown(o, today)
      const insuranceName =
        insurances.find((i) => i.id === patient.insuranceId)?.name ?? null
      const existing = map.get(patient.id)
      if (existing) {
        existing.checklistCount += b.checklist
        existing.overdueCount += b.overdue
        if (o.date < existing.occurrence.date) existing.occurrence = o
      } else {
        map.set(patient.id, {
          patient,
          insuranceName,
          checklistCount: b.checklist,
          overdueCount: b.overdue,
          nextDate: null,
          occurrence: o,
        })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.checklistCount + b.overdueCount -
        (a.checklistCount + a.overdueCount),
    )
  }, [monthOccurrences, patientsById, today, insurances])

  // ── Pendências de meses anteriores ───────────────────────
  const priorPendencyStats = useMemo(() => {
    const longAppts = (longRangeApptsQ.data ?? []).filter((a) =>
      patientsById.has(a.patientId),
    )
    let total = 0
    let overdueTotal = 0
    const monthsWithPendencies = new Set<string>()
    let oldestKey: string | null = null

    for (let i = 12; i >= 1; i--) {
      let m = month - i
      let y = year
      while (m < 1) {
        m += 12
        y -= 1
      }
      const range = monthRangeISO(y, m)
      let monthTotal = 0
      let monthOverdue = 0
      for (const p of patients) {
        const occs = occurrencesForPatient(
          p,
          allSeries,
          { fromISO: range.from, toISO: range.to },
          longAppts,
        )
        for (const o of occs) {
          const b = pendencyBreakdown(o, today)
          const sum = b.checklist + b.overdue
          if (sum === 0) continue
          monthTotal += sum
          if (o.date < today) monthOverdue += sum
        }
      }
      if (monthTotal > 0) {
        const key = `${y}-${String(m).padStart(2, "0")}`
        monthsWithPendencies.add(key)
        total += monthTotal
        overdueTotal += monthOverdue
        if (oldestKey === null || key < oldestKey) oldestKey = key
      }
    }

    if (total === 0 || !oldestKey) return null
    const [oldYStr, oldMStr] = oldestKey.split("-")
    return {
      total,
      overdue: overdueTotal,
      oldestYear: Number(oldYStr),
      oldestMonth: Number(oldMStr),
      monthsWithPendencies: monthsWithPendencies.size,
    }
  }, [longRangeApptsQ.data, patientsById, patients, allSeries, year, month, today])

  // ── Unpaid (atendido & !paid) ────────────────────────────
  const unpaidStats = useMemo(() => {
    const map = new Map<string, UnpaidPatientEntry>()
    let count = 0
    let totalValue = 0
    for (const a of appts) {
      if (a.status !== "attended" || a.paid) continue
      const patient = patientsById.get(a.patientId)
      if (!patient) continue
      const value = effectiveValue(a, patient)
      count++
      totalValue += value
      const insuranceName =
        insurances.find((i) => i.id === patient.insuranceId)?.name ?? null
      const occ: Occurrence = {
        seriesId: a.seriesId,
        patientId: patient.id,
        originDate: a.originDate,
        date: a.date,
        time: a.time ?? seriesById.get(a.seriesId)?.time ?? "08:00",
        appointment: a,
        pendencyCount: 0,
      }
      const existing = map.get(patient.id)
      if (existing) {
        existing.count++
        existing.totalValue += value
        if (occ.date < existing.oldestDate) {
          existing.oldestDate = occ.date
          existing.occurrence = occ
        }
      } else {
        map.set(patient.id, {
          patient,
          insuranceName,
          count: 1,
          totalValue: value,
          oldestDate: occ.date,
          occurrence: occ,
        })
      }
    }
    const items = Array.from(map.values()).sort(
      (a, b) => b.totalValue - a.totalValue,
    )
    return { count, totalValue, items }
  }, [appts, patientsById, insurances, seriesById])

  // ── KPIs ─────────────────────────────────────────────────
  const revenue = useMemo(() => {
    let sum = 0
    for (const a of appts) {
      if (a.paid) sum += effectiveValue(a, patientsById.get(a.patientId))
    }
    return sum
  }, [appts, patientsById])

  const pendingValue = useMemo(() => {
    let sum = 0
    for (const a of appts) {
      const p = patientsById.get(a.patientId)
      if (!p) continue
      if (a.status === "attended" && !a.paid)
        sum += effectiveValue(a, p)
      else if (a.status === "scheduled" && a.date < today)
        sum += p.consultationValue ?? 0
    }
    return sum
  }, [appts, patientsById, today])

  const estimatedBilling = useMemo(() => {
    const range = { fromISO: from, toISO: to }
    let sum = 0
    for (const p of patients) {
      const occs = occurrencesForPatient(p, allSeries, range, appts)
      for (const o of occs) {
        const a = o.appointment
        if (a) {
          if (a.status === "missed" || a.status === "cancelled") continue
          sum += effectiveValue(a, p)
        } else {
          sum += p.consultationValue ?? 0
        }
      }
    }
    return sum
  }, [patients, allSeries, appts, from, to])

  const attendedCount = appts.filter((a) => a.status === "attended").length
  const missedCount = appts.filter((a) => a.status === "missed").length
  const ongoingPatients = patients.filter((p) => !p.dischargedAt).length
  const dischargedTotal = patients.filter((p) => !!p.dischargedAt).length
  const dischargedThisMonth = patients.filter(
    (p) =>
      !!p.dischargedAt &&
      p.dischargedAt >= from &&
      p.dischargedAt <= to,
  ).length
  const newThisMonth = patients.filter(
    (p) => p.createdAt.slice(0, 10) >= from && p.createdAt.slice(0, 10) <= to,
  ).length

  // ── Revenue by day ───────────────────────────────────────
  const revenueByDay = useMemo(() => {
    const map = new Map<string, number>()
    const daysInMonth = endOfMonth(new Date(year, month - 1, 1)).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      map.set(String(d).padStart(2, "0"), 0)
    }
    for (const a of appts) {
      if (!a.paid) continue
      const day = a.date.slice(8, 10)
      const prev = map.get(day) ?? 0
      map.set(day, prev + effectiveValue(a, patientsById.get(a.patientId)))
    }
    return Array.from(map.entries()).map(([day, value]) => ({ day, value }))
  }, [appts, patientsById, year, month])

  // ── Status pie ───────────────────────────────────────────
  const statusPie = useMemo(() => {
    let attended = 0
    let missed = 0
    let pending = 0
    for (const a of appts) {
      if (a.status === "attended") attended++
      else if (a.status === "missed") missed++
      else if (a.status === "scheduled" && a.date <= today) pending++
    }
    return [
      { name: "Atendidos", value: attended },
      { name: "Faltas", value: missed },
      { name: "Pendentes", value: pending },
    ]
  }, [appts, today])

  // ── Top patients ─────────────────────────────────────────
  const topPatients = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of appts) {
      if (a.status !== "attended") continue
      counts.set(a.patientId, (counts.get(a.patientId) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([pid, sessions]) => ({
        name: patientsById.get(pid)?.name ?? "?",
        sessions,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10)
  }, [appts, patientsById])

  // ── Gender pie (ongoing only) ───────────────────────────
  const genderPie = useMemo(() => {
    let f = 0
    let m = 0
    let o = 0
    for (const p of patients) {
      if (p.dischargedAt) continue
      if (p.gender === "female") f++
      else if (p.gender === "male") m++
      else o++
    }
    return [
      { name: "Feminino", value: f },
      { name: "Masculino", value: m },
      { name: "Outro", value: o },
    ]
  }, [patients])

  // ── Insurance pie ────────────────────────────────────────
  const insurancePie = useMemo(() => {
    const counts = new Map<string, number>()
    counts.set("__particular__", 0)
    for (const p of patients) {
      if (p.dischargedAt) continue
      if (!p.insuranceId) {
        counts.set("__particular__", (counts.get("__particular__") ?? 0) + 1)
      } else {
        counts.set(p.insuranceId, (counts.get(p.insuranceId) ?? 0) + 1)
      }
    }
    const insMap = new Map<string, Insurance>()
    for (const i of insurances) insMap.set(i.id, i)
    return Array.from(counts.entries())
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({
        name:
          k === "__particular__"
            ? "Particular"
            : insMap.get(k)?.name ?? "Desconhecido",
        value: v,
      }))
  }, [patients, insurances])

  // ── Discharge reasons pie ────────────────────────────────
  const dischargePie = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of patients) {
      if (!p.dischargedAt) continue
      const k = p.dischargeReasonId ?? "__unknown__"
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const rMap = new Map<string, DischargeReason>()
    for (const r of reasons) rMap.set(r.id, r)
    return Array.from(counts.entries()).map(([k, v]) => ({
      name:
        k === "__unknown__" ? "Sem motivo" : rMap.get(k)?.name ?? "Desconhecido",
      value: v,
    }))
  }, [patients, reasons])

  // ── Monthly revenue (6 months) ──────────────────────────
  const monthlyRevenue = useMemo(() => {
    const longAppts = (longRangeApptsQ.data ?? []).filter((a) =>
      patientsById.has(a.patientId),
    )
    const months = previousMonths(year, month, 6)
    const out = months.map((mm) => ({ month: mm.label, value: 0 }))
    for (const a of longAppts) {
      if (!a.paid) continue
      const m = Number(a.date.slice(5, 7))
      const y = Number(a.date.slice(0, 4))
      const idx = months.findIndex((mm) => mm.year === y && mm.month === m)
      if (idx === -1) continue
      out[idx].value += effectiveValue(a, patientsById.get(a.patientId))
    }
    return out
  }, [longRangeApptsQ.data, patientsById, year, month])

  const activeOcc = useMemo<Occurrence | null>(() => {
    if (!activeKey) return null
    return (
      monthOccurrences.find(
        (o) =>
          o.seriesId === activeKey.seriesId &&
          o.originDate === activeKey.originDate,
      ) ?? null
    )
  }, [activeKey, monthOccurrences])

  const activePatient = activeKey
    ? patientsById.get(activeKey.patientId) ?? null
    : null

  const isLoading =
    apptsQ.isLoading ||
    patientsQ.isLoading ||
    insurancesQ.isLoading ||
    longRangeApptsQ.isLoading ||
    reasonsQ.isLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="shrink-0">
          <Breadcrumbs items={[{ label: "Dashboard" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Visão geral</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
          {priorPendencyStats && (
            <PriorPendenciesBanner
              total={priorPendencyStats.total}
              overdue={priorPendencyStats.overdue}
              oldestYear={priorPendencyStats.oldestYear}
              oldestMonth={priorPendencyStats.oldestMonth}
              monthsWithPendencies={priorPendencyStats.monthsWithPendencies}
              selectedYear={year}
              onJump={(y, m) => {
                setYear(y)
                setMonth(m)
              }}
            />
          )}
          <MonthSelector
            year={year}
            month={month}
            onChange={(y, m) => {
              setYear(y)
              setMonth(m)
            }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait" custom={slideDir} initial={false}>
        <motion.div
          key={`${year}-${month}`}
          custom={slideDir}
          initial={{ x: 24 * slideDir, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -24 * slideDir, opacity: 0 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className="space-y-6"
        >
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
      <>
      {pendencyByPatient.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <PendencyBlock
            totalCount={pendencyStats.total}
            overdueCount={pendencyStats.overdue}
            todayCount={pendencyStats.today}
          />
          <PendencyList
            items={pendencyByPatient}
            today={today}
            onSelect={(it) => {
              setActiveKey({
                seriesId: it.occurrence.seriesId,
                patientId: it.patient.id,
                originDate: it.occurrence.originDate,
              })
              setDrawerOpen(true)
            }}
          />
        </div>
      ) : (
        <PendencyBlock
          totalCount={pendencyStats.total}
          overdueCount={pendencyStats.overdue}
          todayCount={pendencyStats.today}
        />
      )}

      <FinancialGauge
        estimated={estimatedBilling}
        revenue={revenue}
        pending={pendingValue}
        unpaidCount={unpaidStats.count}
        unpaidValue={unpaidStats.totalValue}
        onClickUnpaid={() => setUnpaidOpen(true)}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard label="Atendidos" value={attendedCount} tone="primary" />
        <KpiCard label="Faltas" value={missedCount} tone="muted" />
        <KpiCard
          label="Em tratamento"
          value={ongoingPatients}
          tone="secondary"
        />
        <KpiCard
          label="Encerrados (total)"
          value={dischargedTotal}
          tone="muted"
          hint={`${dischargedThisMonth} no mês`}
        />
        <KpiCard
          label="Novos no mês"
          value={newThisMonth}
          tone="secondary"
        />
        <KpiCard
          label="Total sessões mês"
          value={appts.length}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Faturamento por dia"
          subtitle="Sessões pagas no mês"
        >
          <RevenueByDayChart data={revenueByDay} />
        </ChartCard>
        <ChartCard
          title="Sessões por status"
          subtitle="Atendidos x Faltas x Pendentes"
        >
          <CategoryPie data={statusPie} />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Top pacientes do mês"
          subtitle="Sessões atendidas"
          height={280}
        >
          <TopPatientsChart data={topPatients} />
        </ChartCard>
        <ChartCard
          title="Faturamento mensal"
          subtitle="Últimos 6 meses"
        >
          <MonthlyRevenueChart data={monthlyRevenue} />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard title="Pacientes por gênero" subtitle="Em tratamento">
          <CategoryPie data={genderPie} />
        </ChartCard>
        <ChartCard title="Pacientes por convênio" subtitle="Em tratamento">
          <CategoryPie data={insurancePie} />
        </ChartCard>
        <ChartCard title="Encerramentos por motivo" subtitle="Histórico total">
          <CategoryPie data={dischargePie} />
        </ChartCard>
      </div>
      </>
      )}
        </motion.div>
      </AnimatePresence>

      <PatientDrawer
        occurrence={activeOcc}
        patient={activePatient}
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v)
          if (!v) setActiveKey(null)
        }}
      />

      <UnpaidPatientsDialog
        open={unpaidOpen}
        onOpenChange={setUnpaidOpen}
        items={unpaidStats.items}
        totalValue={unpaidStats.totalValue}
        onSelect={(it) => {
          setActiveKey({
            seriesId: it.occurrence.seriesId,
            patientId: it.patient.id,
            originDate: it.occurrence.originDate,
          })
          setUnpaidOpen(false)
          setDrawerOpen(true)
        }}
      />
    </div>
  )
}
