import { Navigate, Outlet } from 'react-router-dom'
import { useOnboarding } from '../hooks/useOnboarding'

export default function OnboardingGate() {
  const { ready, loading } = useOnboarding()

  if (loading) {
    return null
  }

  if (!ready) {
    return <Navigate to="/setup" replace />
  }

  return <Outlet />
}
