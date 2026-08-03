import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (u: string, p: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const stored = localStorage.getItem('health_sync_auth');
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('health_sync_auth', String(isAuthenticated));
  }, [isAuthenticated]);

  const login = (u: string, p: string) => {
    if (u && p) {
      setIsAuthenticated(true);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
