import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseClient'

const router = Router()

// GET /api/categories
router.get('/', async (req, res) => {
  const userId = req.user!.id

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, user_id, name, icon, color, is_system, created_at')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json(data)
})

// POST /api/categories
router.post('/', async (req, res) => {
  const userId = req.user!.id
  const { name, icon, color } = req.body as { name?: string; icon?: string; color?: string }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({
      user_id: userId,
      name: name.trim(),
      icon: icon ?? null,
      color: color ?? null,
      is_system: false,
    })
    .select('id, user_id, name, icon, color, is_system, created_at')
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(201).json(data)
})

// PATCH /api/categories/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params
  const { name, icon, color } = req.body as { name?: string; icon?: string; color?: string }

  // Verify ownership and non-system
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('categories')
    .select('id, user_id, is_system')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  if (existing.is_system || existing.user_id !== userId) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const updates: Record<string, string | null> = {}
  if (name !== undefined) updates.name = name.trim()
  if (icon !== undefined) updates.icon = icon
  if (color !== undefined) updates.color = color

  const { data, error } = await supabaseAdmin
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select('id, user_id, name, icon, color, is_system, created_at')
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json(data)
})

// DELETE /api/categories/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  // Verify ownership and non-system
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('categories')
    .select('id, user_id, is_system')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  if (existing.is_system || existing.user_id !== userId) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const { error } = await supabaseAdmin
    .from('categories')
    .delete()
    .eq('id', id)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(204).send()
})

export default router
