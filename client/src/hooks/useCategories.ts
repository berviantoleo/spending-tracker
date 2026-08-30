import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/apiClient'

export interface Category {
  id: string
  user_id: string | null
  name: string
  icon: string | null
  color: string | null
  is_system: boolean
  created_at: string
}

export interface CreateCategoryData {
  name: string
  icon?: string
  color?: string
}

export interface UpdateCategoryData {
  name?: string
  icon?: string
  color?: string
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Category[]>('/api/categories')
      setCategories(data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  const createCategory = useCallback(
    async (categoryData: CreateCategoryData): Promise<void> => {
      await apiFetch<Category>('/api/categories', {
        method: 'POST',
        body: JSON.stringify(categoryData),
      })
      await fetchCategories()
    },
    [fetchCategories]
  )

  const updateCategory = useCallback(
    async (id: string, categoryData: UpdateCategoryData): Promise<void> => {
      await apiFetch<Category>(`/api/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(categoryData),
      })
      await fetchCategories()
    },
    [fetchCategories]
  )

  const deleteCategory = useCallback(
    async (id: string): Promise<void> => {
      await apiFetch(`/api/categories/${id}`, { method: 'DELETE' })
      await fetchCategories()
    },
    [fetchCategories]
  )

  return { categories, loading, error, createCategory, updateCategory, deleteCategory }
}
