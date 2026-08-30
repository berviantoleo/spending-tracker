import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

type Tab = 'email' | 'magic' | 'google'

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f7f8fa',
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '2rem',
    width: '100%',
    maxWidth: 420,
  },
  title: {
    margin: '0 0 1.5rem',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1f2328',
    textAlign: 'center',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '1.5rem',
  },
  tab: {
    flex: 1,
    padding: '0.5rem 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#57606a',
    transition: 'color 0.15s, border-color 0.15s',
  },
  activeTab: {
    color: '#3b82d4',
    borderBottom: '2px solid #3b82d4',
    fontWeight: 600,
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#1f2328',
    marginBottom: '0.375rem',
  },
  input: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: '0.9375rem',
    color: '#1f2328',
    background: '#fff',
    boxSizing: 'border-box' as const,
    marginBottom: '1rem',
    outline: 'none',
  },
  btnPrimary: {
    width: '100%',
    padding: '0.625rem',
    background: '#3b82d4',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '0.5rem',
  },
  btnSecondary: {
    width: '100%',
    padding: '0.625rem',
    background: '#f7f8fa',
    color: '#1f2328',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '0.5rem',
  },
  btnGoogle: {
    width: '100%',
    padding: '0.625rem',
    background: '#fff',
    color: '#1f2328',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  message: {
    marginTop: '1rem',
    padding: '0.625rem',
    borderRadius: 6,
    fontSize: '0.875rem',
    textAlign: 'center' as const,
  },
  success: {
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
  },
  error: {
    background: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
  },
}

export default function AuthPage() {
  const { session } = useAuth()
  const [tab, setTab] = useState<Tab>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicEmail, setMagicEmail] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  // Already authenticated — go to dashboard
  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  const clearMsg = () => setMsg(null)

  const handleSignIn = async () => {
    setLoading(true)
    clearMsg()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setMsg({ type: 'error', text: error.message })
  }

  const handleSignUp = async () => {
    setLoading(true)
    clearMsg()
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: 'Account created! Check your email to confirm.' })
    }
  }

  const handleMagicLink = async () => {
    setLoading(true)
    clearMsg()
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: 'Check your email for the magic link!' })
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Spending Tracker</h1>

        <div style={styles.tabs}>
          {(['email', 'magic', 'google'] as Tab[]).map((t) => (
            <button
              key={t}
              style={{ ...styles.tab, ...(tab === t ? styles.activeTab : {}) }}
              onClick={() => { setTab(t); clearMsg() }}
            >
              {t === 'email' ? 'Email' : t === 'magic' ? 'Magic Link' : 'Google'}
            </button>
          ))}
        </div>

        {tab === 'email' && (
          <div>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button style={styles.btnPrimary} onClick={handleSignIn} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <button style={styles.btnSecondary} onClick={handleSignUp} disabled={loading}>
              {loading ? 'Signing up…' : 'Sign Up'}
            </button>
          </div>
        )}

        {tab === 'magic' && (
          <div>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <button style={styles.btnPrimary} onClick={handleMagicLink} disabled={loading}>
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </div>
        )}

        {tab === 'google' && (
          <div>
            <button style={styles.btnGoogle} onClick={handleGoogle}>
              <GoogleIcon />
              Continue with Google
            </button>
          </div>
        )}

        {msg && (
          <div style={{ ...styles.message, ...(msg.type === 'success' ? styles.success : styles.error) }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}
