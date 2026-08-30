import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/apiClient'
import type { Receipt, ReceiptItem } from '../types/receipt'

interface UseReceiptReturn {
  receipt: Receipt | null
  loading: boolean
  error: string | null
  refetch: () => void
  updateReceipt: (fields: Partial<Receipt> & { items?: Omit<ReceiptItem, 'id' | 'receipt_id'>[]; confirm?: boolean }) => Promise<void>
  updateFxRate: (rate: number) => Promise<void>
}

export function useReceipt(id: string): UseReceiptReturn {
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiFetch<Receipt>(`/api/receipts/${id}`)
      .then((data) => {
        if (!cancelled) {
          setReceipt(data)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [id, tick])

  const updateReceipt = useCallback(
    async (fields: Partial<Receipt> & { items?: Omit<ReceiptItem, 'id' | 'receipt_id'>[]; confirm?: boolean }) => {
      await apiFetch<Receipt>(`/api/receipts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      })
      refetch()
    },
    [id, refetch]
  )

  const updateFxRate = useCallback(
    async (rate: number) => {
      await apiFetch<Receipt>(`/api/receipts/${id}/fx`, {
        method: 'PATCH',
        body: JSON.stringify({ rate }),
      })
      refetch()
    },
    [id, refetch]
  )

  return { receipt, loading, error, refetch, updateReceipt, updateFxRate }
}
