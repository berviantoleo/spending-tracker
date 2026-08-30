import { supabaseAdmin } from '../lib/supabaseClient'

const BUCKET = 'receipts'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

export async function uploadReceiptImage(
  userId: string,
  receiptId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = MIME_TO_EXT[mimeType] ?? 'jpg'
  const path = `${userId}/${receiptId}.${ext}`

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  return path
}

export async function getSignedUrl(
  imagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(imagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? 'unknown'}`)
  }

  return data.signedUrl
}
