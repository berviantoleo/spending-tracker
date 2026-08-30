import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useReceipt } from '../hooks/useReceipt'
import { apiFetch } from '../lib/apiClient'
import type { Category } from '../types/receipt'
import type { ReceiptItem } from '../types/receipt'

type EditableItem = Omit<ReceiptItem, 'id' | 'receipt_id'>

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { receipt, loading, error, updateReceipt, updateFxRate } = useReceipt(id!)

  const [categories, setCategories] = useState<Category[]>([])
  const [merchant, setMerchant] = useState('')
  const [receiptDate, setReceiptDate] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<EditableItem[]>([])
  const [editFx, setEditFx] = useState(false)
  const [fxInput, setFxInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Load categories
  useEffect(() => {
    apiFetch<Category[]>('/api/categories').then((c) => { if (c) setCategories(c) }).catch(console.error)
  }, [])

  // Sync form fields when receipt loads
  useEffect(() => {
    if (!receipt) return
    setMerchant(receipt.merchant ?? '')
    setReceiptDate(receipt.receipt_date ?? '')
    setCategoryId(receipt.category_id ?? '')
    setNotes(receipt.notes ?? '')
    setItems(
      (receipt.receipt_items ?? []).map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.total_price,
      }))
    )
    setFxInput(receipt.fx_rate?.toString() ?? '')
  }, [receipt])

  const handleSave = async (confirm = false) => {
    setSaving(true)
    setSaveMsg(null)
    try {
      await updateReceipt({ merchant, receipt_date: receiptDate, category_id: categoryId || undefined, notes, items, confirm })
      setSaveMsg({ type: 'ok', text: confirm ? 'Marked as done!' : 'Saved successfully.' })
    } catch (e) {
      setSaveMsg({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const handleApplyFx = async () => {
    const rate = parseFloat(fxInput)
    if (!isNaN(rate) && rate > 0) {
      setSaving(true)
      try {
        await updateFxRate(rate)
        setEditFx(false)
        setSaveMsg({ type: 'ok', text: 'FX rate updated.' })
      } catch (e) {
        setSaveMsg({ type: 'err', text: e instanceof Error ? e.message : 'FX update failed' })
      } finally {
        setSaving(false)
      }
    }
  }

  const updateItem = (idx: number, field: keyof EditableItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const addItem = () => setItems((prev) => [...prev, { description: '', quantity: 1, unit_price: null, total_price: null }])

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: '#57606a' }}>Loading receipt…</div>
  if (error || !receipt) return <div style={{ padding: 32, textAlign: 'center', color: '#dc2626' }}>{error ?? 'Receipt not found'}</div>

  const showFxSection = receipt.original_currency && receipt.base_currency && receipt.original_currency !== receipt.base_currency

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Back link */}
      <a href="/receipts" style={{ color: '#3b82d4', fontSize: 14, textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>
        ← Back to Receipts
      </a>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 24 }}>
        {/* Left panel — image */}
        <div>
          <div style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {receipt.imageUrl
              ? <img src={receipt.imageUrl} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              : <span style={{ color: '#57606a', fontSize: 14 }}>No image available</span>
            }
          </div>
        </div>

        {/* Right panel — editable form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Review banner */}
          {receipt.status === 'needs_review' && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, padding: '10px 14px', color: '#92400e', fontSize: 14 }}>
              ⚠ This receipt needs your review. Please verify the details below and click <strong>Confirm &amp; mark done</strong>.
            </div>
          )}

          {/* Merchant */}
          <label style={labelStyle}>
            Merchant
            <input value={merchant} onChange={(e) => setMerchant(e.target.value)} style={inputStyle} placeholder="Merchant name" />
          </label>

          {/* Date */}
          <label style={labelStyle}>
            Date
            <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} style={inputStyle} />
          </label>

          {/* Category */}
          <label style={labelStyle}>
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle}>
              <option value="">— Select category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon ?? ''} {c.name}</option>
              ))}
            </select>
          </label>

          {/* Notes */}
          <label style={labelStyle}>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} placeholder="Optional notes" />
          </label>

          {/* FX section */}
          {showFxSection && (
            <div style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 13, color: '#57606a', marginBottom: 6 }}>Exchange Rate</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14 }}>
                  1 {receipt.original_currency} = <strong>{receipt.fx_rate ?? '?'}</strong> {receipt.base_currency}
                </span>
                <span style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: receipt.fx_rate_source === 'manual' ? '#ede9fe' : '#dbeafe',
                  color: receipt.fx_rate_source === 'manual' ? '#6d28d9' : '#1e40af',
                }}>
                  {receipt.fx_rate_source ?? 'unknown'}
                </span>
                {receipt.original_amount !== null && receipt.base_amount !== null && (
                  <span style={{ fontSize: 13, color: '#57606a' }}>
                    ({receipt.original_amount} {receipt.original_currency} = {receipt.base_amount} {receipt.base_currency})
                  </span>
                )}
                <button onClick={() => setEditFx((v) => !v)} style={linkBtnStyle}>
                  {editFx ? 'Cancel' : 'Edit rate'}
                </button>
              </div>
              {editFx && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    type="number"
                    step="any"
                    value={fxInput}
                    onChange={(e) => setFxInput(e.target.value)}
                    style={{ ...inputStyle, width: 140 }}
                    placeholder="Rate"
                  />
                  <button onClick={handleApplyFx} style={primaryBtnStyle} disabled={saving}>Apply</button>
                </div>
              )}
            </div>
          )}

          {/* Line items */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#1f2328' }}>Line Items</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#57606a', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', width: 50 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', width: 80 }}>Unit</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', width: 80 }}>Total</th>
                  <th style={{ width: 28 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '3px 6px' }}>
                      <input value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} style={{ ...inputStyle, padding: '2px 4px', fontSize: 13 }} />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 1)} style={{ ...inputStyle, padding: '2px 4px', fontSize: 13, width: '100%', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input type="number" step="any" value={item.unit_price ?? ''} onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, padding: '2px 4px', fontSize: 13, width: '100%', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input type="number" step="any" value={item.total_price ?? ''} onChange={(e) => updateItem(idx, 'total_price', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, padding: '2px 4px', fontSize: 13, width: '100%', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addItem} style={{ ...linkBtnStyle, marginTop: 6 }}>+ Add item</button>
          </div>

          {/* Save message */}
          {saveMsg && (
            <div style={{ fontSize: 13, color: saveMsg.type === 'ok' ? '#065f46' : '#dc2626', background: saveMsg.type === 'ok' ? '#d1fae5' : '#fee2e2', padding: '6px 12px', borderRadius: 4 }}>
              {saveMsg.text}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => handleSave(false)} style={primaryBtnStyle} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {receipt.status === 'needs_review' && (
              <button onClick={() => handleSave(true)} style={{ ...primaryBtnStyle, background: '#065f46' }} disabled={saving}>
                ✓ Confirm &amp; mark done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 4,
  padding: '6px 10px',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
}

const primaryBtnStyle: React.CSSProperties = {
  background: '#3b82d4',
  color: '#fff',
  border: 'none',
  borderRadius: 5,
  padding: '8px 18px',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
}

const linkBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#3b82d4',
  cursor: 'pointer',
  fontSize: 13,
  padding: 0,
}
