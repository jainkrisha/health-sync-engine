/**
 * AuthContext — local stub auth for Phase A.
 *
 * OWNERSHIP: Person A.
 *
 * No network calls, no real credentials. Stores the current "user" in
 * React state only. Phase B will swap this context out with a real auth
 * solution — no other files should call backend auth APIs directly.
 */

import { createContext, useContext, useState, type ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StubUser {
  id: string
  name: string
  role: 'field_worker'
}

interface AuthContextValue {
  user: StubUser | null
  login: (name: string) => void
  logout: () => void
  isAuthenticated: boolean
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StubUser | null>(null)

  const login = (name: string) => {
    // Stub: accept any non-empty name, assign a fixed device-local id
    setUser({ id: 'local-worker-001', name, role: 'field_worker' })
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: user !== null }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
