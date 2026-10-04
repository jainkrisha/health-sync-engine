import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { getSession, onSessionChange, setSession, type Session } from '../lib/authStore';
import type { Portal, PublicUser, Role } from '@shared/types';

interface AuthResponse {
  token: string;
  role: Role;
  user: PublicUser;
}

export interface RegisterInput {
  username: string;
  name: string;
  password: string;
  role: Role;
  portal: Portal;
  /** PHC name; the server fills in the district hospital for district accounts. */
  facility?: string;
}

interface AuthContextType {
  user: PublicUser | null;
  role: Role | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, portal?: Portal) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setState] = useState<Session | null>(getSession);

  useEffect(() => onSessionChange(setState), []);

  const login = useCallback(async (username: string, password: string, portal?: Portal) => {
    const res = await api<AuthResponse>('/auth/login', { method: 'POST', body: { username, password, portal } });
    setSession({ token: res.token, user: res.user });
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await api<AuthResponse>('/auth/register', { method: 'POST', body: input });
    setSession({ token: res.token, user: res.user });
  }, []);

  const logout = useCallback(() => setSession(null), []);

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      role: session?.user.role ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session),
      login,
      register,
      logout,
    }),
    [session, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
