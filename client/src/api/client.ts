/**
 * client.ts — small fetch wrapper for the HealthSync REST API.
 * Attaches the JWT, parses JSON and turns error responses into ApiError.
 */
import { getSession, setSession } from '../lib/authStore';

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  status: number;
  details?: string[];

  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const session = getSession();
  if (session) headers.Authorization = `Bearer ${session.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; details?: string[] };
  if (!res.ok) {
    if (res.status === 401 && session && path !== '/auth/login') setSession(null);
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.details);
  }
  return data as T;
}
