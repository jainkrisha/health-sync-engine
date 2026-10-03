/**
 * authStore.ts — the logged-in session for this device profile.
 * Kept outside React so the API client and the sync engine can read the token.
 */
import { profileKey } from './deviceProfile';
import type { PublicUser } from '@shared/types';

export interface Session {
  token: string;
  user: PublicUser;
}

const KEY = profileKey('auth');
type Listener = (session: Session | null) => void;
const listeners = new Set<Listener>();

function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isExpired(token: string): boolean {
  const exp = tokenExpiry(token);
  return exp !== null && exp < Date.now();
}

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session.token || !session.user || isExpired(session.token)) return null;
    return session;
  } catch {
    return null;
  }
}

let current: Session | null = load();

export function getSession(): Session | null {
  return current;
}

export function setSession(session: Session | null): void {
  current = session;
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable, keep the in-memory session
  }
  listeners.forEach((l) => l(session));
}

export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
