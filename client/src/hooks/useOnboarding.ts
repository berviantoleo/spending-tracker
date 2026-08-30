import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiClient'

interface Preferences {
  base_currency?: string | null
}

interface OnboardingState {
  ready: boolean
  loading: boolean
}

export function useOnboarding(): OnboardingState {
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<Preferences>('/api/preferences')
      .then((prefs) => {
        if (prefs && prefs.base_currency) {
          setReady(true)
        } else {
          setReady(false)
        }
      })
      .catch(() => {
        setReady(false)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { ready, loading }
}
