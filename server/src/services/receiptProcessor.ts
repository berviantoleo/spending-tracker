import { supabaseAdmin } from '../lib/supabaseClient'
import { getSignedUrl } from './storageService'
import { extractReceiptData } from './watsonxService'
import { getRate, FxUnavailableError } from './fxService'

export async function processReceipt(receiptId: string, userId: string): Promise<void> {
  console.log(`[receiptProcessor] Starting processing for receipt ${receiptId}`)

  try {
    // 1. Fetch receipt row to get image_path
    const { data: receipt, error: fetchError } = await supabaseAdmin
      .from('receipts')
      .select('id, image_path, status')
      .eq('id', receiptId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !receipt) {
      throw new Error(`Receipt ${receiptId} not found: ${fetchError?.message}`)
    }

    if (!receipt.image_path) {
      throw new Error(`Receipt ${receiptId} has no image_path`)
    }

    // 2. Download image from Supabase Storage
    const signedUrl = await getSignedUrl(receipt.image_path as string)
    const imageResponse = await fetch(signedUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`)
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    const imageBase64 = imageBuffer.toString('base64')

    // Infer mimeType from file extension in image_path
    const ext = (receipt.image_path as string).split('.').pop()?.toLowerCase() ?? 'jpg'
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
    }
    const mimeType = mimeMap[ext] ?? 'image/jpeg'

    // 3. Call watsonx.ai
    const aiResult = await extractReceiptData(imageBase64, mimeType)
    console.log(`[receiptProcessor] AI result for ${receiptId}:`, JSON.stringify(aiResult))

    // 4. Resolve category_id from suggested_category
    let categoryId: string | null = null
    if (aiResult.suggested_category) {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('id')
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .ilike('name', aiResult.suggested_category)
        .limit(1)
        .single()
      categoryId = cat?.id ?? null
    }

    // 5. Fetch user's base_currency
    const { data: prefs } = await supabaseAdmin
      .from('user_preferences')
      .select('base_currency')
      .eq('user_id', userId)
      .single()

    const baseCurrency = prefs?.base_currency as string | null

    // 6. FX conversion
    let baseAmount: number | null = null
    let fxRate: number | null = null
    let fxRateSource: string | null = null
    let fxRateAt: string | null = null
    let needsFx = false

    const originalAmount = aiResult.total
    const originalCurrency = aiResult.currency

    if (originalAmount !== null && originalCurrency && baseCurrency) {
      if (originalCurrency.toUpperCase() === baseCurrency.toUpperCase()) {
        baseAmount = originalAmount
        fxRate = 1
        fxRateSource = 'api'
        fxRateAt = new Date().toISOString()
      } else {
        try {
          const fx = await getRate(originalCurrency, baseCurrency, aiResult.date ?? undefined)
          baseAmount = Math.round(originalAmount * fx.rate * 100) / 100
          fxRate = fx.rate
          fxRateSource = fx.source
          fxRateAt = fx.fetchedAt
        } catch (err) {
          if (err instanceof FxUnavailableError) {
            console.warn(`[receiptProcessor] FX unavailable for ${originalCurrency}→${baseCurrency}: ${err.message}`)
            needsFx = true
          } else {
            throw err
          }
        }
      }
    }

    // 7. Determine final status
    const lowConfidence = aiResult.confidence < 0.7
    const missingCategory = categoryId === null
    const missingTotal = aiResult.total === null
    const missingCurrency = aiResult.currency === null
    const missingBaseCurrency = baseCurrency === null
    const missingFx = needsFx

    const status =
      lowConfidence || missingCategory || missingTotal || missingCurrency || missingBaseCurrency || missingFx
        ? 'needs_review'
        : 'done'

    // 8. Upsert receipt_items — delete existing, then insert new
    await supabaseAdmin.from('receipt_items').delete().eq('receipt_id', receiptId)

    if (aiResult.items.length > 0) {
      const itemRows = aiResult.items.map((item) => ({
        receipt_id: receiptId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }))
      const { error: itemsError } = await supabaseAdmin.from('receipt_items').insert(itemRows)
      if (itemsError) {
        console.error(`[receiptProcessor] Failed to insert receipt_items: ${itemsError.message}`)
      }
    }

    // 9. Update receipts row
    const { error: updateError } = await supabaseAdmin
      .from('receipts')
      .update({
        merchant: aiResult.merchant,
        receipt_date: aiResult.date,
        original_amount: originalAmount,
        original_currency: originalCurrency,
        base_amount: baseAmount,
        base_currency: baseCurrency,
        fx_rate: fxRate,
        fx_rate_source: fxRateSource,
        fx_rate_at: fxRateAt,
        category_id: categoryId,
        status,
        raw_ai_response: aiResult,
        updated_at: new Date().toISOString(),
      })
      .eq('id', receiptId)

    if (updateError) {
      throw new Error(`Failed to update receipt: ${updateError.message}`)
    }

    console.log(`[receiptProcessor] Receipt ${receiptId} processing complete — status: ${status}`)
  } catch (err) {
    console.error(`[receiptProcessor] Error processing receipt ${receiptId}:`, err)
    // Mark as needs_review so user can manually handle it
    await supabaseAdmin
      .from('receipts')
      .update({ status: 'needs_review', updated_at: new Date().toISOString() })
      .eq('id', receiptId)
  }
}
