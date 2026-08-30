import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/apiClient'

export interface Preferences {
  user_id: string
  base_currency: string | null
  created_at: string
  updated_at: string
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPreferences = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // apiFetch returns null on 404 — that is expected for first-time users
      const data = await apiFetch<Preferences>('/api/preferences')
      setPreferences(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPreferences()
  }, [fetchPreferences])

  const updateCurrency = useCallback(async (currency: string): Promise<void> => {
    const data = await apiFetch<Preferences>('/api/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ base_currency: currency }),
    })
    setPreferences(data)
  }, [])

  return { preferences, loading, error, updateCurrency, refetch: fetchPreferences }
}
