import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseClient'

const router = Router()

// GET /api/preferences
router.get('/', async (req, res) => {
  const userId = req.user!.id

  const { data, error } = await supabaseAdmin
    .from('user_preferences')
    .select('user_id, base_currency, created_at, updated_at')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No row found
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.status(500).json({ error: error.message })
    return
  }

  res.json(data)
})

// POST /api/preferences
router.post('/', async (req, res) => {
  const userId = req.user!.id
  const { base_currency } = req.body as { base_currency?: string }

  if (!base_currency || typeof base_currency !== 'string' || base_currency.trim() === '') {
    res.status(400).json({ error: 'base_currency is required' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('user_preferences')
    .upsert(
      { user_id: userId, base_currency: base_currency.trim(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select('user_id, base_currency, created_at, updated_at')
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(201).json(data)
})

// PATCH /api/preferences
router.patch('/', async (req, res) => {
  const userId = req.user!.id
  const { base_currency } = req.body as { base_currency?: string }

  if (!base_currency || typeof base_currency !== 'string' || base_currency.trim() === '') {
    res.status(400).json({ error: 'base_currency is required' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('user_preferences')
    .update({ base_currency: base_currency.trim(), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('user_id, base_currency, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.status(500).json({ error: error.message })
    return
  }

  res.json(data)
})

export default router
