import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/receipts', label: 'Receipts', icon: '🧾' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav — desktop */}
      <nav style={{
        display: 'none',
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 24px',
        height: 56,
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }} className="desktop-nav">
        <div style={{ fontWeight: 700, fontSize: 18, color: '#1f2328' }}>💰 Spending Tracker</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: location.pathname === item.path ? '#eff6ff' : 'none',
                border: 'none',
                color: location.pathname === item.path ? '#1d4ed8' : '#374151',
                fontWeight: location.pathname === item.path ? 600 : 400,
                padding: '6px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#57606a' }}>{user?.email}</span>
          <button
            onClick={signOut}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 5, padding: '4px 10px', fontSize: 13, cursor: 'pointer', color: '#57606a' }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, paddingBottom: 72 }}>
        {children}
      </main>

      {/* Bottom nav — mobile */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        height: 64,
        zIndex: 100,
      }} className="mobile-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              cursor: 'pointer',
              color: location.pathname === item.path ? '#1d4ed8' : '#57606a',
              fontWeight: location.pathname === item.path ? 600 : 400,
            }}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 11 }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* CSS for responsive nav switching */}
      <style>{`
        @media (min-width: 640px) {
          .desktop-nav { display: flex !important; }
          .mobile-nav { display: none !important; }
          main { padding-bottom: 0 !important; }
        }
      `}</style>
    </div>
  )
}
