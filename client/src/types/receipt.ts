export interface ReceiptItem {
  id: string
  receipt_id: string
  description: string
  quantity: number
  unit_price: number | null
  total_price: number | null
}

export interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
}

export type ReceiptStatus = 'pending' | 'processing' | 'needs_review' | 'done'
export type FxRateSource = 'api' | 'cached' | 'manual'

export interface Receipt {
  id: string
  user_id: string
  merchant: string | null
  receipt_date: string | null
  original_amount: number | null
  original_currency: string | null
  base_amount: number | null
  base_currency: string | null
  fx_rate: number | null
  fx_rate_source: FxRateSource | null
  fx_rate_at: string | null
  category_id: string | null
  status: ReceiptStatus
  image_path: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  receipt_items?: ReceiptItem[]
  categories?: Category | null
  imageUrl?: string | null
}
