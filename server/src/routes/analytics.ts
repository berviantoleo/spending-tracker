import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseClient'

const router = Router()

// GET /api/analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/summary', async (req, res) => {
  const userId = req.user!.id
  const { from, to } = req.query as { from?: string; to?: string }

  // Build receipts query with date filters
  let receiptsQuery = supabaseAdmin
    .from('receipts')
    .select('base_amount, original_amount, original_currency, category_id, receipt_items(total_price)')
    .eq('user_id', userId)
    .eq('status', 'done')

  if (from) receiptsQuery = receiptsQuery.gte('receipt_date', from)
  if (to) receiptsQuery = receiptsQuery.lte('receipt_date', to)

  const { data: receipts, error } = await receiptsQuery

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const rows = receipts ?? []

  // Grand total in base currency
  const grandTotal = rows.reduce((sum, r) => sum + (Number(r.base_amount) || 0), 0)

  // Breakdown by category_id
  const byCategory: Record<string, number> = {}
  for (const r of rows) {
    const key = (r.category_id as string | null) ?? 'uncategorized'
    byCategory[key] = (byCategory[key] ?? 0) + (Number(r.base_amount) || 0)
  }

  // Breakdown by original currency
  const byCurrency: Record<string, { count: number; total: number }> = {}
  for (const r of rows) {
    const cur = (r.original_currency as string | null) ?? 'UNKNOWN'
    if (!byCurrency[cur]) byCurrency[cur] = { count: 0, total: 0 }
    byCurrency[cur].count += 1
    byCurrency[cur].total += Number(r.original_amount) || 0
  }

  // Total items purchased
  const totalItems = rows.reduce((sum, r) => {
    const items = (r.receipt_items as Array<{ total_price: number | null }>) ?? []
    return sum + items.length
  }, 0)

  res.json({
    grandTotal: Math.round(grandTotal * 100) / 100,
    receiptCount: rows.length,
    totalItems,
    byCategory,
    byCurrency,
  })
})

export default router
