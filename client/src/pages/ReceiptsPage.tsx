import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/apiClient'
import { ReceiptCard } from '../components/ReceiptCard'
import { ReceiptUploader } from '../components/ReceiptUploader'
import type { Receipt } from '../types/receipt'
import type { Category } from '../types/receipt'

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [uploaderOpen, setUploaderOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  // Filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchReceipts = useCallback(async (resetPage = false) => {
    const currentPage = resetPage ? 1 : page
    if (resetPage) setPage(1)
    setLoading(true)
    const params = new URLSearchParams({ page: String(currentPage), limit: '20' })
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)
    if (categoryFilter) params.set('category_id', categoryFilter)
    if (statusFilter) params.set('status', statusFilter)

    const data = await apiFetch<{ data: Receipt[]; total: number }>(`/api/receipts?${params}`)
    if (data) {
      setReceipts(resetPage ? data.data : (prev) => [...prev, ...data.data])
      setTotal(data.total)
    }
    setLoading(false)
  }, [page, fromDate, toDate, categoryFilter, statusFilter])

  useEffect(() => {
    apiFetch<Category[]>('/api/categories').then((c) => setCategories(c ?? [])).catch(console.error)
  }, [])

  useEffect(() => {
    fetchReceipts(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, categoryFilter, statusFilter])

  const loadMore = async () => {
    const nextPage = page + 1
    setPage(nextPage)
    setLoading(true)
    const params = new URLSearchParams({ page: String(nextPage), limit: '20' })
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)
    if (categoryFilter) params.set('category_id', categoryFilter)
    if (statusFilter) params.set('status', statusFilter)
    const data = await apiFetch<{ data: Receipt[]; total: number }>(`/api/receipts?${params}`)
    if (data) {
      setReceipts((prev) => [...prev, ...data.data])
      setTotal(data.total)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1f2328' }}>Receipts</h1>
        <button
          onClick={() => setUploaderOpen(true)}
          style={{ background: '#3b82d4', color: '#fff', border: 'none', borderRadius: 5, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          + Upload Receipt
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, padding: 12, background: '#f7f8fa', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={filterInputStyle} placeholder="From" title="From date" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={filterInputStyle} placeholder="To" title="To date" />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={filterInputStyle}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.icon ?? ''} {c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={filterInputStyle}>
          <option value="">All statuses</option>
          <option value="done">Done</option>
          <option value="needs_review">Needs Review</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
        </select>
        <button
          onClick={() => { setFromDate(''); setToDate(''); setCategoryFilter(''); setStatusFilter('') }}
          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 10px', fontSize: 13, cursor: 'pointer', color: '#57606a' }}
        >
          Clear
        </button>
      </div>

      {/* Count */}
      <div style={{ fontSize: 13, color: '#57606a', marginBottom: 12 }}>{total} receipt{total !== 1 ? 's' : ''}</div>

      {/* Grid */}
      {loading && receipts.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#57606a', padding: 32 }}>Loading…</div>
      ) : receipts.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#57606a', padding: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🧾</div>
          <div>No receipts yet. Upload your first receipt!</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {receipts.map((r) => (
            <ReceiptCard key={r.id} receipt={r} onUpdated={() => fetchReceipts(true)} />
          ))}
        </div>
      )}

      {/* Load more */}
      {receipts.length < total && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={loadMore}
            disabled={loading}
            style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: 5, padding: '8px 20px', cursor: 'pointer', fontSize: 14, color: '#1f2328' }}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {/* Uploader modal */}
      <ReceiptUploader
        isOpen={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        onUploaded={() => { setUploaderOpen(false); fetchReceipts(true) }}
      />
    </div>
  )
}

const filterInputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 4,
  padding: '5px 8px',
  fontSize: 13,
  background: '#fff',
  color: '#1f2328',
}
