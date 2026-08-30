import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { apiFetch } from '../lib/apiClient'
import { ReceiptCard } from '../components/ReceiptCard'
import { ReceiptUploader } from '../components/ReceiptUploader'
import type { Receipt, Category } from '../types/receipt'

interface AnalyticsSummary {
  grandTotal: number
  receiptCount: number
  totalItems: number
  byCategory: Record<string, number>
  byCurrency: Record<string, { count: number; total: number }>
}

const PERIOD_OPTIONS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Custom', value: 'custom' },
]

function getPeriodDates(period: string): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split('T')[0]
  if (period === 'week') {
    const from = new Date(now)
    from.setDate(now.getDate() - 7)
    return { from: from.toISOString().split('T')[0], to }
  }
  if (period === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to }
  }
  return { from: '', to: '' }
}

const CHART_COLORS = ['#3b82d4', '#7c5cd8', '#f59e0b', '#10b981', '#ef4444', '#f97316', '#06b6d4', '#84cc16']

export default function DashboardPage() {
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [recentReceipts, setRecentReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [uploaderOpen, setUploaderOpen] = useState(false)

  const { from, to } = period === 'custom'
    ? { from: customFrom, to: customTo }
    : getPeriodDates(period)

  useEffect(() => {
    apiFetch<Category[]>('/api/categories').then((c) => setCategories(c ?? [])).catch(console.error)
  }, [])

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    Promise.all([
      apiFetch<AnalyticsSummary>(`/api/analytics/summary?${params}`),
      apiFetch<{ data: Receipt[] }>(`/api/receipts?limit=5&page=1${from ? `&from_date=${from}` : ''}${to ? `&to_date=${to}` : ''}`),
    ]).then(([s, r]) => {
      setSummary(s)
      setRecentReceipts(r?.data ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [period, from, to, customFrom, customTo])

  const categoryChartData = summary
    ? Object.entries(summary.byCategory).map(([catId, amount]) => {
        const cat = categories.find((c) => c.id === catId)
        return { name: cat?.name ?? 'Other', value: Math.round(amount * 100) / 100, fill: cat?.color ?? '#9e9e9e' }
      }).sort((a, b) => b.value - a.value)
    : []

  const baseCurrency = recentReceipts[0]?.base_currency ?? ''

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1f2328' }}>💰 Spending Tracker</h1>
        <button
          onClick={() => setUploaderOpen(true)}
          style={{ background: '#3b82d4', color: '#fff', border: 'none', borderRadius: 5, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          + Upload Receipt
        </button>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            style={{
              padding: '5px 14px',
              borderRadius: 16,
              border: '1px solid',
              borderColor: period === opt.value ? '#3b82d4' : '#e5e7eb',
              background: period === opt.value ? '#eff6ff' : '#fff',
              color: period === opt.value ? '#1d4ed8' : '#374151',
              fontWeight: period === opt.value ? 600 : 400,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {opt.label}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={filterInputStyle} />
            <span style={{ color: '#57606a', fontSize: 13 }}>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={filterInputStyle} />
          </>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#57606a', padding: 48 }}>Loading…</div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <SummaryCard label="Total Spent" value={`${baseCurrency} ${(summary?.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <SummaryCard label="Receipts" value={String(summary?.receiptCount ?? 0)} />
            <SummaryCard label="Items Purchased" value={String(summary?.totalItems ?? 0)} />
          </div>

          {/* Charts */}
          {categoryChartData.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 20, marginBottom: 28 }}>
              {/* Bar chart */}
              <div style={chartCardStyle}>
                <div style={chartTitleStyle}>Spending by Category</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${baseCurrency} ${Number(v).toFixed(2)}`, 'Amount']} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {categoryChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill || CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart */}
              <div style={chartCardStyle}>
                <div style={chartTitleStyle}>Category Breakdown</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={false}>
                      {categoryChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill || CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" iconSize={10} formatter={(v: string) => <span style={{ fontSize: 12 }}>{v}</span>} />
                    <Tooltip formatter={(v) => [`${baseCurrency} ${Number(v).toFixed(2)}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Currency breakdown */}
          {summary && Object.keys(summary.byCurrency).length > 1 && (
            <div style={{ marginBottom: 28 }}>
              <div style={chartTitleStyle}>Currencies Used</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {Object.entries(summary.byCurrency).map(([cur, info]) => (
                  <span key={cur} style={{ background: '#f7f8fa', border: '1px solid #e5e7eb', borderRadius: 16, padding: '4px 12px', fontSize: 13 }}>
                    <strong>{cur}</strong> — {info.count} receipt{info.count !== 1 ? 's' : ''}, {info.total.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent receipts */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={chartTitleStyle}>Recent Receipts</div>
              <a href="/receipts" style={{ fontSize: 13, color: '#3b82d4', textDecoration: 'none' }}>View all →</a>
            </div>
            {recentReceipts.length === 0 ? (
              <div style={{ color: '#57606a', fontSize: 13, textAlign: 'center', padding: 24, background: '#f7f8fa', borderRadius: 8 }}>
                No receipts in this period. <button onClick={() => setUploaderOpen(true)} style={{ background: 'none', border: 'none', color: '#3b82d4', cursor: 'pointer', fontSize: 13 }}>Upload one now.</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {recentReceipts.map((r) => (
                  <ReceiptCard key={r.id} receipt={r} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ReceiptUploader
        isOpen={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        onUploaded={() => { setUploaderOpen(false); /* re-fetch */ window.location.reload() }}
      />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#57606a', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1f2328' }}>{value}</div>
    </div>
  )
}

const chartCardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 16,
}

const chartTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 8,
}

const filterInputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 4,
  padding: '5px 8px',
  fontSize: 13,
  background: '#fff',
  color: '#1f2328',
}
