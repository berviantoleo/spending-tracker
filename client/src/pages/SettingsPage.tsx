import { useState, type FormEvent } from 'react'
import { usePreferences } from '../hooks/usePreferences'
import { useCategories, type Category } from '../hooks/useCategories'
import { CURRENCIES } from '../lib/currencies'

// ---- inline styles ----
const styles = {
  page: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
    color: '#1f2328',
    fontSize: 15,
    lineHeight: 1.6,
  } as React.CSSProperties,
  heading: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' } as React.CSSProperties,
  section: {
    background: '#f7f8fa',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  sectionTitle: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' } as React.CSSProperties,
  muted: { color: '#57606a', fontSize: 13, marginBottom: '0.75rem' } as React.CSSProperties,
  row: { display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' as const },
  input: {
    padding: '0.45rem 0.75rem',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 14,
    background: '#fff',
    color: '#1f2328',
  } as React.CSSProperties,
  select: {
    padding: '0.45rem 0.75rem',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 14,
    background: '#fff',
    color: '#1f2328',
    minWidth: 220,
  } as React.CSSProperties,
  btn: {
    padding: '0.45rem 1.1rem',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    background: '#3b82d4',
    color: '#fff',
    fontWeight: 600,
  } as React.CSSProperties,
  btnDanger: {
    padding: '0.3rem 0.75rem',
    border: '1px solid #fca5a5',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
    background: '#fef2f2',
    color: '#b91c1c',
    fontWeight: 500,
  } as React.CSSProperties,
  btnSecondary: {
    padding: '0.3rem 0.75rem',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
    background: '#fff',
    color: '#1f2328',
    fontWeight: 500,
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '0.1rem 0.5rem',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: '#e5e7eb',
    color: '#57606a',
    marginLeft: 6,
  } as React.CSSProperties,
  categoryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.5rem 0',
    borderBottom: '1px solid #e5e7eb',
  } as React.CSSProperties,
  colorSwatch: (color: string | null) =>
    ({
      width: 18,
      height: 18,
      borderRadius: 4,
      background: color ?? '#e5e7eb',
      border: '1px solid #e5e7eb',
      flexShrink: 0,
    }) as React.CSSProperties,
  toast: (isError: boolean) =>
    ({
      display: 'inline-block',
      padding: '0.3rem 0.75rem',
      borderRadius: 6,
      fontSize: 13,
      marginLeft: 12,
      background: isError ? '#fef2f2' : '#f0fdf4',
      color: isError ? '#b91c1c' : '#15803d',
      border: `1px solid ${isError ? '#fca5a5' : '#bbf7d0'}`,
    }) as React.CSSProperties,
}

// ---- Currency Section ----
function CurrencySection() {
  const { preferences, loading, error, updateCurrency } = usePreferences()
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null)

  const currentCode = preferences?.base_currency ?? ''

  const filtered = CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  )

  const effectiveSelected = selected || currentCode

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!effectiveSelected) return
    setSaving(true)
    setToast(null)
    try {
      await updateCurrency(effectiveSelected)
      setToast({ msg: 'Currency saved!', error: false })
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Save failed', error: true })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p style={styles.muted}>Loading preferences…</p>
  if (error) return <p style={{ ...styles.muted, color: '#b91c1c' }}>Error: {error}</p>

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Base Currency</h2>
      <p style={styles.muted}>All spending is converted to this currency for reporting.</p>
      <form onSubmit={handleSave}>
        <div style={{ ...styles.row, marginBottom: '0.75rem' }}>
          <input
            style={{ ...styles.input, width: 160 }}
            placeholder="Search currencies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search currencies"
          />
          <select
            style={styles.select}
            value={effectiveSelected}
            onChange={(e) => setSelected(e.target.value)}
            required
            aria-label="Select currency"
          >
            <option value="">— select currency —</option>
            {filtered.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <button type="submit" style={styles.btn} disabled={saving || !effectiveSelected}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {toast && <span style={styles.toast(toast.error)}>{toast.msg}</span>}
        </div>
      </form>
    </section>
  )
}

// ---- Category Add / Edit Form ----
interface CategoryFormProps {
  initial?: { name: string; icon: string; color: string }
  onSubmit: (data: { name: string; icon: string; color: string }) => Promise<void>
  onCancel?: () => void
  submitLabel: string
}

function CategoryForm({ initial, onSubmit, onCancel, submitLabel }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '')
  const [color, setColor] = useState(initial?.color ?? '#6b7280')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true)
    setErr(null)
    try {
      await onSubmit({ name: name.trim(), icon: icon.trim(), color })
      if (!initial) {
        setName(''); setIcon(''); setColor('#6b7280')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...styles.row, flexWrap: 'wrap', marginTop: '0.5rem' }}>
      <input
        style={{ ...styles.input, flex: 1, minWidth: 120 }}
        placeholder="Category name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        style={{ ...styles.input, width: 60 }}
        placeholder="Icon"
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
        title="Emoji or short text"
      />
      <input
        type="color"
        style={{ ...styles.input, padding: '0.3rem', width: 48, cursor: 'pointer' }}
        value={color}
        onChange={(e) => setColor(e.target.value)}
        title="Pick a colour"
      />
      <button type="submit" style={styles.btn} disabled={saving}>
        {saving ? '…' : submitLabel}
      </button>
      {onCancel && (
        <button type="button" style={styles.btnSecondary} onClick={onCancel}>
          Cancel
        </button>
      )}
      {err && <span style={styles.toast(true)}>{err}</span>}
    </form>
  )
}

// ---- Category Row ----
interface CategoryRowProps {
  cat: Category
  onUpdate: (id: string, data: { name: string; icon: string; color: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function CategoryRow({ cat, onUpdate, onDelete }: CategoryRowProps) {
  const [editing, setEditing] = useState(false)

  async function handleDelete() {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return
    await onDelete(cat.id)
  }

  if (editing) {
    return (
      <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
        <CategoryForm
          initial={{ name: cat.name, icon: cat.icon ?? '', color: cat.color ?? '#6b7280' }}
          submitLabel="Update"
          onSubmit={async (data) => { await onUpdate(cat.id, data); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div style={styles.categoryRow}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>{cat.icon ?? '🏷️'}</span>
      <div style={styles.colorSwatch(cat.color)} />
      <span style={{ flex: 1 }}>{cat.name}</span>
      {cat.is_system ? (
        <span style={styles.badge}>System</span>
      ) : (
        <>
          <button style={styles.btnSecondary} onClick={() => setEditing(true)}>Edit</button>
          <button style={styles.btnDanger} onClick={handleDelete}>Delete</button>
        </>
      )}
    </div>
  )
}

// ---- Categories Section ----
function CategoriesSection() {
  const { categories, loading, error, createCategory, updateCategory, deleteCategory } =
    useCategories()

  if (loading) return <p style={styles.muted}>Loading categories…</p>
  if (error) return <p style={{ ...styles.muted, color: '#b91c1c' }}>Error: {error}</p>

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Spending Categories</h2>
      <p style={styles.muted}>
        System categories cannot be modified. You can add custom categories below.
      </p>
      <div>
        {categories.map((cat) => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            onUpdate={updateCategory}
            onDelete={deleteCategory}
          />
        ))}
      </div>
      <div style={{ marginTop: '1rem' }}>
        <p style={{ ...styles.muted, marginBottom: '0.25rem' }}>
          <strong>Add category</strong>
        </p>
        <CategoryForm
          submitLabel="Add"
          onSubmit={(data) => createCategory(data)}
        />
      </div>
    </section>
  )
}

// ---- Page ----
export default function SettingsPage() {
  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Settings</h1>
      <p style={{ ...styles.muted, marginBottom: '1.5rem' }}>
        Manage your account preferences and spending categories.
      </p>
      <CurrencySection />
      <CategoriesSection />
    </div>
  )
}
