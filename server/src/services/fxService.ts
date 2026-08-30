import { supabaseAdmin } from '../lib/supabaseClient'

export type FxRateSource = 'api' | 'cached' | 'manual'

export interface FxResult {
  rate: number
  source: FxRateSource
  fetchedAt: string // ISO timestamp
}

export class FxUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FxUnavailableError'
  }
}

const FX_API_BASE = process.env.FX_API_BASE_URL ?? 'https://api.frankfurter.app'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function getRate(from: string, to: string, date?: string): Promise<FxResult> {
  // Same currency — no conversion needed
  if (from.toUpperCase() === to.toUpperCase()) {
    return { rate: 1, source: 'api', fetchedAt: new Date().toISOString() }
  }

  const fromUpper = from.toUpperCase()
  const toUpper = to.toUpperCase()

  // Check DB cache
  const { data: cached } = await supabaseAdmin
    .from('currency_rates')
    .select('*')
    .eq('from_currency', fromUpper)
    .eq('to_currency', toUpper)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single()

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at as string).getTime()
    if (age < CACHE_TTL_MS) {
      return {
        rate: Number(cached.rate),
        source: 'cached',
        fetchedAt: cached.fetched_at as string,
      }
    }
  }

  // Fetch from frankfurter.app
  const endpoint = date
    ? `${FX_API_BASE}/${date}?from=${fromUpper}&to=${toUpper}`
    : `${FX_API_BASE}/latest?from=${fromUpper}&to=${toUpper}`

  let rate: number
  try {
    const response = await fetch(endpoint)
    if (!response.ok) {
      throw new FxUnavailableError(`FX API returned ${response.status}`)
    }
    const json = (await response.json()) as { rates?: Record<string, number> }
    if (!json.rates || json.rates[toUpper] === undefined) {
      throw new FxUnavailableError(`Currency pair ${fromUpper}/${toUpper} not found in FX API response`)
    }
    rate = json.rates[toUpper]
  } catch (err) {
    if (err instanceof FxUnavailableError) throw err
    throw new FxUnavailableError(`FX API fetch failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  const fetchedAt = new Date().toISOString()

  // Insert into cache (ignore conflict on unique constraint)
  await supabaseAdmin.from('currency_rates').insert({
    from_currency: fromUpper,
    to_currency: toUpper,
    rate,
    source: 'api',
    fetched_at: fetchedAt,
  })

  return { rate, source: 'api', fetchedAt }
}
