import { supabase } from './supabaseClient'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return `Bearer ${token}`
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T | null> {
  const authorization = await getAuthHeader()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: authorization,
    ...(options.headers as Record<string, string>),
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 204) return null
  if (res.status === 404) return null

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  return res.json() as Promise<T>
}
