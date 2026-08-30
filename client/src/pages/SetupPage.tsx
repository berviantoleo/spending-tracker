import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CURRENCIES } from '../lib/currencies'
import { apiFetch } from '../lib/apiClient'

export default function SetupPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return CURRENCIES
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    )
  }, [search])

  async function handleSubmit() {
    if (!selectedCurrency) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch('/api/preferences', {
        method: 'POST',
        body: JSON.stringify({ base_currency: selectedCurrency }),
      })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>💰 Spending Tracker</div>
        <h1 style={styles.heading}>Welcome! Let's get started.</h1>
        <p style={styles.subtext}>
          Choose your base currency. All your spending will be tracked and
          reported in this currency.
        </p>

        <div style={styles.fieldGroup}>
          <input
            type="text"
            placeholder="Search currency…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedCurrency('')
            }}
            style={styles.input}
            aria-label="Search currency"
          />
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            style={styles.select}
            aria-label="Select a currency"
          >
            <option value="" disabled>
              Select a currency
            </option>
            {filtered.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!selectedCurrency || loading}
          style={{
            ...styles.button,
            ...((!selectedCurrency || loading) ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? (
            <span style={styles.spinner} aria-label="Loading" />
          ) : (
            'Get Started'
          )}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f4f6',
    padding: '24px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '48px 40px',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  logo: {
    fontSize: '22px',
    fontWeight: 700,
    marginBottom: '24px',
    color: '#1f2328',
  },
  heading: {
    fontSize: '24px',
    fontWeight: 700,
    margin: '0 0 12px',
    color: '#1f2328',
  },
  subtext: {
    fontSize: '15px',
    color: '#57606a',
    margin: '0 0 28px',
    lineHeight: 1.6,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
  },
  input: {
    padding: '10px 12px',
    fontSize: '15px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    outline: 'none',
    color: '#1f2328',
  },
  select: {
    padding: '10px 12px',
    fontSize: '15px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    background: '#ffffff',
    color: '#1f2328',
    cursor: 'pointer',
  },
  error: {
    color: '#c0392b',
    fontSize: '14px',
    margin: '0 0 16px',
  },
  button: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    fontWeight: 600,
    background: '#3b82d4',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '46px',
  },
  buttonDisabled: {
    background: '#b0c4de',
    cursor: 'not-allowed',
  },
  spinner: {
    display: 'inline-block',
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
}

// Inject the keyframe once
if (typeof document !== 'undefined' && !document.getElementById('setup-spin-kf')) {
  const style = document.createElement('style')
  style.id = 'setup-spin-kf'
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }'
  document.head.appendChild(style)
}
