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
  useIndividualChecklist,
  useInsurances,
  usePatients,
  useSharedChecklist,
} from "@/api/queries"
import {
  endOfMonth,
  startOfMonth,
  toISO,
  todayISO,
} from "@/domain/dates"
import { effectiveValue, formatBRL } from "@/domain/finance"
import { occurrencesForPatient } from "@/domain/recurrence"
import { MonthSelector } from "@/components/dashboard/month-selector"
import { PendencyBlock } from "@/components/dashboard/pendency-block"
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
import { Breadcrumbs } from "@/components/breadcrumbs"
import { DashboardSkeleton } from "@/components/dashboard/skeletons"
import { cn } from "@/lib/utils"

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
  const sharedQ = useSharedChecklist()
  const indivQ = useIndividualChecklist()

  const sixMonthStart = useMemo(() => {
    let m = month - 5
    let y = year
    while (m < 1) {
      m += 12
      y -= 1
    }
    return toISO(startOfMonth(new Date(y, m - 1, 1)))
  }, [year, month])
  const sixMonthEnd = useMemo(
    () => toISO(endOfMonth(new Date(year, month - 1, 1))),
    [year, month],
  )
  const longRangeApptsQ = useAppointmentsInRange(sixMonthStart, sixMonthEnd)

  const allPatients = patientsQ.data ?? []
  const insurances = insurancesQ.data ?? []
  const reasons = reasonsQ.data ?? []
  const allAppts = apptsQ.data ?? []
  const allSeries = seriesQ.data ?? []
  const shared = sharedQ.data ?? []
  const individual = indivQ.data ?? []

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

  const sharedActiveCount = shared.filter((s) => !s.archived).length
  const individualByPatient = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of individual) {
      if (it.archived) continue
      m.set(it.patientId, (m.get(it.patientId) ?? 0) + 1)
    }
    return m
  }, [individual])

  function countPendencyItems(
    appt: (typeof appts)[number],
    patient: Patient | undefined,
  ): {
    checklist: number
    unpaid: number
    overdue: number
    unpaidValue: number
  } {
    if (appt.status === "cancelled" || appt.status === "rescheduled") {
      return { checklist: 0, unpaid: 0, overdue: 0, unpaidValue: 0 }
    }
    if (appt.date > today) {
      return { checklist: 0, unpaid: 0, overdue: 0, unpaidValue: 0 }
    }
    let checklist = 0
    if (appt.status === "attended" || appt.status === "missed") {
      checklist = appt.snapshotItemIds.filter(
        (id) => !appt.checkedItemIds.includes(id),
      ).length
    } else {
      checklist =
        sharedActiveCount + (individualByPatient.get(appt.patientId) ?? 0)
    }
    const unpaid = appt.status === "attended" && !appt.paid ? 1 : 0
    const unpaidValue = unpaid ? effectiveValue(appt, patient) : 0
    const overdue =
      appt.status === "scheduled" && appt.date < today ? 1 : 0
    return { checklist, unpaid, overdue, unpaidValue }
  }

  // ── Pendency totals (item-level) ─────────────────────────
  const pendencyStats = useMemo(() => {
    let total = 0
    let overdue = 0
    let todayN = 0
    for (const a of appts) {
      const c = countPendencyItems(a, patientsById.get(a.patientId))
      const sum = c.checklist + c.unpaid + c.overdue
      if (sum === 0) continue
      total += sum
      if (a.date < today) overdue += sum
      else todayN += sum
    }
    return { total, overdue, today: todayN }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appts, patientsById, sharedActiveCount, individualByPatient, today])

  // ── Pendency by patient (cards) ──────────────────────────
  const pendencyByPatient = useMemo<PendencyBreakdown[]>(() => {
    const map = new Map<string, PendencyBreakdown>()
    for (const a of appts) {
      const patient = patientsById.get(a.patientId)
      if (!patient) continue
      const c = countPendencyItems(a, patient)
      const pendSum = c.checklist + c.unpaid + c.overdue
      if (pendSum === 0) continue
      const insuranceName =
        insurances.find((i) => i.id === patient.insuranceId)?.name ?? null
      const occ: Occurrence = {
        seriesId: a.seriesId,
        patientId: patient.id,
        originDate: a.originDate,
        date: a.status === "rescheduled" && a.rescheduledTo ? a.rescheduledTo : a.date,
        time: a.time ?? seriesById.get(a.seriesId)?.time ?? "08:00",
        appointment: a,
        pendencyCount: pendSum,
      }
      const existing = map.get(patient.id)
      if (existing) {
        existing.checklistCount += c.checklist
        existing.unpaidCount += c.unpaid
        existing.overdueCount += c.overdue
        existing.unpaidValue += c.unpaidValue
        if (occ.date < existing.occurrence.date) {
          existing.occurrence = occ
        }
      } else {
        map.set(patient.id, {
          patient,
          insuranceName,
          checklistCount: c.checklist,
          unpaidCount: c.unpaid,
          overdueCount: c.overdue,
          unpaidValue: c.unpaidValue,
          nextDate: null,
          occurrence: occ,
        })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.checklistCount + b.unpaidCount + b.overdueCount -
        (a.checklistCount + a.unpaidCount + a.overdueCount),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appts, patientsById, sharedActiveCount, individualByPatient, today, insurances])

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
    const a = appts.find(
      (x) =>
        x.seriesId === activeKey.seriesId &&
        x.originDate === activeKey.originDate,
    )
    if (!a) return null
    const c = countPendencyItems(a, patientsById.get(a.patientId))
    return {
      seriesId: a.seriesId,
      patientId: a.patientId,
      originDate: a.originDate,
      date:
        a.status === "rescheduled" && a.rescheduledTo
          ? a.rescheduledTo
          : a.date,
      time: a.time ?? seriesById.get(a.seriesId)?.time ?? "08:00",
      appointment: a,
      pendencyCount: c.checklist + c.unpaid + c.overdue,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, appts, patientsById, seriesById, sharedActiveCount, individualByPatient, today])

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
        <div>
          <Breadcrumbs items={[{ label: "Dashboard" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Visão geral</p>
        </div>
        <MonthSelector
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y)
            setMonth(m)
          }}
        />
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
      ) : pendencyByPatient.length > 0 ? (
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
        <div className="grid gap-3 lg:grid-cols-2">
          <PendencyBlock
            totalCount={pendencyStats.total}
            overdueCount={pendencyStats.overdue}
            todayCount={pendencyStats.today}
          />
          <div className="grid gap-3 grid-cols-2">
            <KpiCard
              label="Estimado no mês"
              value={formatBRL(estimatedBilling)}
              tone="primary"
              hint="Sessões agendadas restantes"
            />
            <KpiCard
              label="Faturado no mês"
              value={formatBRL(revenue)}
              tone="success"
            />
            <KpiCard
              label="Pendente no mês"
              value={formatBRL(pendingValue)}
              tone="warning"
              hint="Não pago + sessões vencidas"
            />
            <KpiCard label="Atendidos" value={attendedCount} tone="primary" />
          </div>
        </div>
      )}

      {!isLoading && (
      <>
      {pendencyByPatient.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Estimado no mês"
            value={formatBRL(estimatedBilling)}
            tone="primary"
            hint="Sessões agendadas restantes"
          />
          <KpiCard
            label="Faturado no mês"
            value={formatBRL(revenue)}
            tone="success"
          />
          <KpiCard
            label="Pendente no mês"
            value={formatBRL(pendingValue)}
            tone="warning"
            hint="Não pago + sessões vencidas"
          />
          <KpiCard label="Atendidos" value={attendedCount} tone="primary" />
          <KpiCard label="Faltas" value={missedCount} tone="muted" />
        </div>
      )}

      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2",
          pendencyByPatient.length === 0
            ? "lg:grid-cols-5"
            : "lg:grid-cols-4",
        )}
      >
        {pendencyByPatient.length === 0 && (
          <KpiCard label="Faltas" value={missedCount} tone="muted" />
        )}
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
    </div>
  )
}
