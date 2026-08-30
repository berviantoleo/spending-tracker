import { Router } from 'express'
import { randomUUID } from 'crypto'
import multer from 'multer'
import { supabaseAdmin } from '../lib/supabaseClient'
import { uploadReceiptImage } from '../services/storageService'
import { processReceipt } from '../services/receiptProcessor'
import { getSignedUrl } from '../services/storageService'

const router = Router()

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
]

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
})

// POST /api/receipts/upload
router.post('/upload', upload.single('receipt'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }

  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
    res.status(400).json({ error: 'Invalid file type' })
    return
  }

  const userId = req.user!.id
  const receiptId = randomUUID()

  // 1. Upload image to Supabase Storage
  let storagePath: string
  try {
    storagePath = await uploadReceiptImage(
      userId,
      receiptId,
      req.file.buffer,
      req.file.mimetype
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    res.status(500).json({ error: message })
    return
  }

  const now = new Date().toISOString()

  // 2. Insert receipts row with status 'pending'
  const { error: insertError } = await supabaseAdmin
    .from('receipts')
    .insert({
      id: receiptId,
      user_id: userId,
      status: 'pending',
      image_path: storagePath,
      created_at: now,
      updated_at: now,
    })

  if (insertError) {
    res.status(500).json({ error: insertError.message })
    return
  }

  // 3. Update status to 'processing'
  const { error: updateError } = await supabaseAdmin
    .from('receipts')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', receiptId)

  if (updateError) {
    res.status(500).json({ error: updateError.message })
    return
  }

  // 4. Fire-and-forget: process receipt in background
  processReceipt(receiptId, userId).catch(console.error)

  // 5. Respond immediately
  res.status(201).json({ id: receiptId, status: 'processing' })
})

// PATCH /api/receipts/:id/fx  — manual FX rate override
router.patch('/:id/fx', async (req, res) => {
  const { id } = req.params
  const { rate } = req.body as { rate?: unknown }

  if (typeof rate !== 'number' || rate <= 0) {
    res.status(400).json({ error: 'rate must be a positive number' })
    return
  }

  const userId = req.user!.id

  // Fetch receipt
  const { data: receipt, error: fetchError } = await supabaseAdmin
    .from('receipts')
    .select('id, original_amount, original_currency, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !receipt) {
    res.status(404).json({ error: 'Receipt not found' })
    return
  }

  // Fetch user's base_currency
  const { data: prefs } = await supabaseAdmin
    .from('user_preferences')
    .select('base_currency')
    .eq('user_id', userId)
    .single()

  const baseCurrency = prefs?.base_currency as string | null

  const originalAmount = receipt.original_amount as number | null
  const baseAmount =
    originalAmount !== null ? Math.round(originalAmount * rate * 100) / 100 : null

  const now = new Date().toISOString()

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('receipts')
    .update({
      fx_rate: rate,
      fx_rate_source: 'manual',
      fx_rate_at: now,
      base_amount: baseAmount,
      base_currency: baseCurrency,
      // Promote needs_review → done when FX was the only blocker
      status: receipt.status === 'needs_review' ? 'done' : receipt.status,
      updated_at: now,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    res.status(500).json({ error: updateError.message })
    return
  }

  res.json(updated)
})

// GET /api/receipts/:id  — fetch single receipt with items and signed image URL
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user!.id

  const { data: receipt, error } = await supabaseAdmin
    .from('receipts')
    .select('*, receipt_items(*), categories(id, name, icon, color)')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !receipt) {
    res.status(404).json({ error: 'Receipt not found' })
    return
  }

  // Generate a signed URL for the image
  let imageUrl: string | null = null
  if (receipt.image_path) {
    try {
      imageUrl = await getSignedUrl(receipt.image_path as string)
    } catch {
      imageUrl = null
    }
  }

  res.json({ ...receipt, imageUrl })
})

// GET /api/receipts  — paginated list with filters, always includes receipt_items
router.get('/', async (req, res) => {
  const userId = req.user!.id
  const {
    page = '1',
    limit = '20',
    category_id,
    status,
    from_date,
    to_date,
    currency,
  } = req.query as Record<string, string>

  const pageNum = Math.max(1, parseInt(page, 10))
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)))
  const offset = (pageNum - 1) * limitNum

  let query = supabaseAdmin
    .from('receipts')
    .select('*, receipt_items(*), categories(id, name, icon, color)', { count: 'exact' })
    .eq('user_id', userId)
    .order('receipt_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1)

  if (category_id) query = query.eq('category_id', category_id)
  if (status) query = query.eq('status', status)
  if (from_date) query = query.gte('receipt_date', from_date)
  if (to_date) query = query.lte('receipt_date', to_date)
  if (currency) query = query.eq('original_currency', currency.toUpperCase())

  const { data, error, count } = await query

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({
    data: data ?? [],
    total: count ?? 0,
    page: pageNum,
    limit: limitNum,
  })
})

// PATCH /api/receipts/:id  — update receipt fields (manual correction)
router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user!.id

  const {
    merchant,
    receipt_date,
    category_id,
    notes,
    original_amount,
    original_currency,
    items,
    confirm,
  } = req.body as {
    merchant?: string
    receipt_date?: string
    category_id?: string
    notes?: string
    original_amount?: number
    original_currency?: string
    items?: Array<{ description: string; quantity: number; unit_price?: number; total_price?: number }>
    confirm?: boolean
  }

  // Verify ownership
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('receipts')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !existing) {
    res.status(404).json({ error: 'Receipt not found' })
    return
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (merchant !== undefined) updates.merchant = merchant
  if (receipt_date !== undefined) updates.receipt_date = receipt_date
  if (category_id !== undefined) updates.category_id = category_id
  if (notes !== undefined) updates.notes = notes
  if (original_amount !== undefined) updates.original_amount = original_amount
  if (original_currency !== undefined) updates.original_currency = original_currency
  if (confirm) updates.status = 'done'

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('receipts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    res.status(500).json({ error: updateError.message })
    return
  }

  // Update line items if provided
  if (items !== undefined) {
    await supabaseAdmin.from('receipt_items').delete().eq('receipt_id', id)
    if (items.length > 0) {
      await supabaseAdmin.from('receipt_items').insert(
        items.map((item) => ({
          receipt_id: id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price ?? null,
          total_price: item.total_price ?? null,
        }))
      )
    }
  }

  res.json(updated)
})

export default router
