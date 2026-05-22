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
