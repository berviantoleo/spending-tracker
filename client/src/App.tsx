import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import OnboardingGate from './components/OnboardingGate'
import { Layout } from './components/Layout'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ReceiptsPage from './pages/ReceiptsPage'
import SettingsPage from './pages/SettingsPage'
import SetupPage from './pages/SetupPage'
import ReceiptDetailPage from './pages/ReceiptDetailPage'

function LayoutWrapper() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Setup — requires auth but NOT onboarding gate (it IS the gate destination) */}
          <Route element={<RequireAuth />}>
            <Route path="/setup" element={<SetupPage />} />
          </Route>

          {/* Protected — requires auth AND completed onboarding, wrapped in Layout */}
          <Route element={<RequireAuth />}>
            <Route element={<OnboardingGate />}>
              <Route element={<LayoutWrapper />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/receipts" element={<ReceiptsPage />} />
                <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
