import { Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "@/context/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { AppShell } from "@/components/app-shell"
import { LoginPage } from "@/pages/login"
import { HomePage } from "@/pages/home"
import { PatientsPage } from "@/pages/patients"
import { SharedChecklistPage } from "@/pages/checklist"
import { DashboardPage } from "@/pages/dashboard"
import { InsurancesPage } from "@/pages/insurances"
import { DischargeReasonsPage } from "@/pages/discharge-reasons"
import { FinanceLayout } from "@/components/finance/finance-layout"
import { FinanceLedgerPage } from "@/pages/finance-ledger"
import { FinanceDashboardPage } from "@/pages/finance-dashboard"
import { FinancePeoplePage } from "@/pages/finance-people"
import { FinanceCategoriesPage } from "@/pages/finance-categories"
import { FinancePaymentMethodsPage } from "@/pages/finance-payment-methods"
import { ReadingLayout } from "@/components/reading/reading-layout"
import { ReadingTrackPage } from "@/pages/reading-track"
import { ReadingDashboardPage } from "@/pages/reading-dashboard"

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agenda" element={<HomePage />} />
          <Route path="/financeiro" element={<FinanceLayout />}>
            <Route index element={<FinanceLedgerPage />} />
            <Route path="dashboard" element={<FinanceDashboardPage />} />
            <Route path="pessoas" element={<FinancePeoplePage />} />
            <Route
              path="cadastros/categorias"
              element={<FinanceCategoriesPage />}
            />
            <Route
              path="cadastros/formas-de-pagamento"
              element={<FinancePaymentMethodsPage />}
            />
          </Route>
          <Route path="/leituras" element={<ReadingLayout />}>
            <Route index element={<ReadingTrackPage />} />
            <Route path="dashboard" element={<ReadingDashboardPage />} />
          </Route>
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/insurances" element={<InsurancesPage />} />
          <Route
            path="/discharge-reasons"
            element={<DischargeReasonsPage />}
          />
          <Route path="/checklist" element={<SharedChecklistPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
