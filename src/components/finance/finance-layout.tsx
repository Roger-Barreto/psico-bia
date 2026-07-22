import { useEffect, useRef } from "react"
import { Outlet } from "react-router-dom"
import {
  useEnsureRecurring,
  useFinanceCategories,
  usePaymentMethods,
  useSeedFinanceDefaults,
} from "@/api/queries"
import { materializeUntilPeriod } from "@/domain/finance"

/**
 * Shared shell for all /financeiro/* pages: seeds default categories/payment
 * methods on first use and materializes recurring rows up to the current month.
 * Runs once regardless of which finance page the user lands on.
 */
export function FinanceLayout() {
  const categoriesQ = useFinanceCategories()
  const methodsQ = usePaymentMethods()
  const seed = useSeedFinanceDefaults()
  const ensure = useEnsureRecurring()
  const seededRef = useRef(false)
  const ensuredRef = useRef(false)

  useEffect(() => {
    if (seededRef.current) return
    if (!categoriesQ.isSuccess || !methodsQ.isSuccess) return
    if ((categoriesQ.data?.length ?? 0) > 0 || (methodsQ.data?.length ?? 0) > 0)
      return
    seededRef.current = true
    seed.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesQ.isSuccess, methodsQ.isSuccess])

  useEffect(() => {
    if (ensuredRef.current) return
    ensuredRef.current = true
    // Materialize a few months ahead so recurring items already show in the
    // next card invoices (which land 1–2 months after the purchase month).
    ensure.mutate(materializeUntilPeriod())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Outlet />
}
