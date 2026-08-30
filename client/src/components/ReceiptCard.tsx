import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Receipt, ReceiptItem } from '../types/receipt'

interface ReceiptCardProps {
  receipt: Receipt
  onUpdated?: () => void
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:      { bg: '#f3f4f6', color: '#6b7280', label: 'Pending' },
  processing:   { bg: '#f3f4f6', color: '#6b7280', label: '⟳ Processing…' },
  needs_review: { bg: '#fef3c7', color: '#92400e', label: '⚠ Needs Review' },
  done:         { bg: '#d1fae5', color: '#065f46', label: '✓ Done' },
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null || currency === null) return '—'
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ReceiptCard({ receipt, onUpdated }: ReceiptCardProps) {
  const navigate = useNavigate()
  const [itemsOpen, setItemsOpen] = useState(false)

  const statusStyle = STATUS_STYLES[receipt.status] ?? STATUS_STYLES.pending
  const items: ReceiptItem[] = receipt.receipt_items ?? []

  // Realtime subscription when status is 'processing'
  useEffect(() => {
    if (receipt.status !== 'processing') return

    const channel = supabase
      .channel(`receipt-${receipt.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'receipts', filter: `id=eq.${receipt.id}` },
        () => { onUpdated?.() }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [receipt.id, receipt.status, onUpdated])

  const handleCardClick = () => {
    navigate(`/receipts/${receipt.id}`)
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: '#1f2328' }}>
          {receipt.merchant ?? 'Unknown Merchant'}
        </span>
        <span style={{ fontSize: 12, color: '#57606a' }}>
          {receipt.receipt_date ?? '—'}
        </span>
      </div>

      {/* Category + Status */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        {receipt.categories && (
          <span style={{
            background: receipt.categories.color ?? '#e5e7eb',
            color: '#fff',
            borderRadius: 12,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 500,
          }}>
            {receipt.categories.icon ?? ''} {receipt.categories.name}
          </span>
        )}
        <span style={{
          background: statusStyle.bg,
          color: statusStyle.color,
          borderRadius: 12,
          padding: '2px 8px',
          fontSize: 12,
          fontWeight: 500,
        }}>
          {statusStyle.label}
        </span>
      </div>

      {/* Amount */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1f2328', marginBottom: 8 }}>
        <span style={{ fontWeight: 500 }}>{formatAmount(receipt.original_amount, receipt.original_currency)}</span>
        {receipt.original_currency !== receipt.base_currency && receipt.base_amount !== null && (
          <>
            <span style={{ color: '#57606a' }}>→</span>
            <span style={{ color: '#3b82d4', fontWeight: 500 }}>{formatAmount(receipt.base_amount, receipt.base_currency)}</span>
          </>
        )}
      </div>

      {/* Collapsible items */}
      {items.length > 0 && (
        <div onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setItemsOpen((o) => !o)}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82d4',
              cursor: 'pointer',
              fontSize: 12,
              padding: '2px 0',
              marginBottom: itemsOpen ? 8 : 0,
            }}
          >
            {itemsOpen ? `Hide items` : `Show items (${items.length})`}
          </button>
          {itemsOpen && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: '#57606a', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>Item</th>
                  <th style={{ textAlign: 'right', padding: '2px 4px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '2px 4px' }}>Unit</th>
                  <th style={{ textAlign: 'right', padding: '2px 4px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '2px 4px' }}>{item.description}</td>
                    <td style={{ textAlign: 'right', padding: '2px 4px' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '2px 4px' }}>{item.unit_price?.toFixed(2) ?? '—'}</td>
                    <td style={{ textAlign: 'right', padding: '2px 4px' }}>{item.total_price?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
