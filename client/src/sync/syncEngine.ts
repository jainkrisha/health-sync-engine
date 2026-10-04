/**
 * syncEngine.ts — real-time synchronisation between this device and the server.
 *
 * - Connects to the server over Socket.io, authenticated with the JWT and this
 *   device's clientId.
 * - triggerSync(): pushes pending outbox mutations (oldest first, in batches),
 *   records the server's verdict for each (synced / conflict / rejected), applies
 *   the merged canonical records it returns, then pulls anything else that
 *   changed since the last sync.
 * - Listens for "patient:changed" broadcasts from other devices.
 * - Re-syncs automatically when the browser comes back online or reconnects.
 * - A "simulate offline" switch disconnects without touching the real network,
 *   which is how the two-device demo is run on one laptop.
 */
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  type Conflict,
  type PatientDoc,
  type PullResponse,
  type PushResponse,
} from '@shared/types';
import { API_BASE } from '../api/client';
import { getSession, onSessionChange } from '../lib/authStore';
import { deviceLabel, getClientId, profileKey } from '../lib/deviceProfile';
import { getMeta, setMeta } from '../db/db';
import {
  countPending,
  getPendingMutations,
  markMutationResults,
  pruneOutbox,
} from '../db/mutationLog';
import { applyServerDocs, dropSyncedPatients } from '../db/patientRepo';
import { onDataChanged } from '../lib/events';

export type SyncStatus = 'offline' | 'connecting' | 'syncing' | 'idle' | 'error' | 'signed_out';

export interface SyncState {
  status: SyncStatus;
  connected: boolean;
  simulatedOffline: boolean;
  browserOnline: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** Results of the last push that were rejected or flagged, for user feedback. */
  lastPush: { synced: number; conflicts: number; rejected: number } | null;
}

const SIM_KEY = profileKey('simulateOffline');
const BATCH_SIZE = 100;
const ACK_TIMEOUT_MS = 20_000;

type Listener = (state: SyncState) => void;
type ConflictListener = (conflict: Conflict) => void;

function readSimulatedOffline(): boolean {
  try {
    return localStorage.getItem(SIM_KEY) === 'true';
  } catch {
    return false;
  }
}

class SyncEngine {
  private socket: Socket | null = null;
  private listeners = new Set<Listener>();
  private conflictListeners = new Set<ConflictListener>();
  private syncing: Promise<void> | null = null;
  private resyncRequested = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  state: SyncState = {
    status: 'signed_out',
    connected: false,
    simulatedOffline: readSimulatedOffline(),
    browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
    lastPush: null,
  };

  /** Called once at app start-up. */
  start(): void {
    if (this.started) return;
    this.started = true;
    void getMeta<string | null>('lastSyncedAt', null).then((v) => this.set({ lastSyncedAt: v }));
    void this.refreshPending();

    window.addEventListener('online', () => {
      this.set({ browserOnline: true });
      this.connect();
    });
    window.addEventListener('offline', () => this.set({ browserOnline: false, status: 'offline' }));
    onSessionChange(() => this.connect());
    onDataChanged(() => {
      void this.refreshPending();
      this.scheduleSync();
    });
    this.connect();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onConflict(listener: ConflictListener): () => void {
    this.conflictListeners.add(listener);
    return () => this.conflictListeners.delete(listener);
  }

  setSimulatedOffline(value: boolean): void {
    try {
      localStorage.setItem(SIM_KEY, String(value));
    } catch {
      // ignore
    }
    this.set({ simulatedOffline: value });
    this.connect();
  }

  /** Push pending edits and pull remote changes. Safe to call at any time. */
  triggerSync(): Promise<void> {
    if (!this.socket?.connected) {
      this.connect();
      return Promise.resolve();
    }
    if (this.syncing) {
      this.resyncRequested = true;
      return this.syncing;
    }
    this.syncing = this.runSync().finally(() => {
      this.syncing = null;
      if (this.resyncRequested) {
        this.resyncRequested = false;
        void this.triggerSync();
      }
    });
    return this.syncing;
  }

  private set(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private async refreshPending(): Promise<void> {
    try {
      this.set({ pendingCount: await countPending() });
    } catch {
      // IndexedDB unavailable; leave the count as is
    }
  }

  private scheduleSync(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.triggerSync(), 300);
  }

  private disconnect(status: SyncStatus): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.set({ connected: false, status });
  }

  /** (Re)connect according to session, browser connectivity and the offline switch. */
  private connect(): void {
    const session = getSession();
    if (!session) return this.disconnect('signed_out');
    if (this.state.simulatedOffline || !navigator.onLine) return this.disconnect('offline');

    const auth = { token: session.token, clientId: getClientId(), deviceName: deviceLabel };
    if (this.socket) {
      const current = this.socket.auth as { token?: string };
      if (current.token === session.token) {
        if (!this.socket.connected) this.socket.connect();
        return;
      }
      this.disconnect('connecting');
    }

    this.set({ status: 'connecting' });
    const socket = io(API_BASE || undefined, {
      auth,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.set({ connected: true, status: 'idle', lastError: null });
      void this.triggerSync();
    });
    socket.on('disconnect', () => {
      this.set({ connected: false, status: navigator.onLine ? 'connecting' : 'offline' });
    });
    socket.on('connect_error', (err: Error) => {
      this.set({
        connected: false,
        status: 'error',
        lastError: err.message || 'Cannot reach the sync server',
      });
    });
    socket.on(SOCKET_EVENTS.patientChanged, (data: { patient: PatientDoc }) => {
      void applyServerDocs([data.patient]);
    });
    socket.on(SOCKET_EVENTS.conflictChanged, (data: { conflict: Conflict }) => {
      this.conflictListeners.forEach((l) => l(data.conflict));
    });
  }

  private async runSync(): Promise<void> {
    const socket = this.socket;
    if (!socket?.connected) return;
    this.set({ status: 'syncing' });
    try {
      let synced = 0;
      let conflicts = 0;
      let rejected = 0;

      // 1. Push in order, in batches.
      for (;;) {
        const pending = (await getPendingMutations()).slice(0, BATCH_SIZE);
        if (pending.length === 0) break;
        const response = await this.emitWithAck<PushResponse & { error?: string }>(
          SOCKET_EVENTS.push,
          { mutations: pending },
        );
        if (response.error) throw new Error(response.error);
        await markMutationResults(response.results);
        await applyServerDocs(response.patients);
        synced += response.results.filter((r) => r.status === 'synced').length;
        conflicts += response.results.filter((r) => r.status === 'conflict').length;
        rejected += response.results.filter((r) => r.status === 'rejected').length;
        await this.refreshPending();
        if (pending.length < BATCH_SIZE) break;
      }

      // 2. Pull whatever else changed since our last pull.
      let since = await getMeta<number>('lastServerSeq', 0);
      let pulled = await this.emitWithAck<PullResponse & { error?: string }>(SOCKET_EVENTS.pull, {
        since,
      });
      if (pulled.error) throw new Error(pulled.error);
      const knownEpoch = await getMeta<number | null>('serverEpoch', null);
      // (A device that has never seen an epoch does one full refresh too.)
      if (pulled.epoch !== undefined && pulled.epoch !== knownEpoch && since > 0) {
        // The server's data was reset; our copies point at records that no longer exist.
        await dropSyncedPatients();
        since = 0;
        pulled = await this.emitWithAck<PullResponse & { error?: string }>(SOCKET_EVENTS.pull, {
          since,
        });
        if (pulled.error) throw new Error(pulled.error);
      }
      await applyServerDocs(pulled.patients);
      await setMeta('lastServerSeq', pulled.serverSeq);
      if (pulled.epoch !== undefined) await setMeta('serverEpoch', pulled.epoch);

      const now = new Date().toISOString();
      await setMeta('lastSyncedAt', now);
      await pruneOutbox();
      await this.refreshPending();
      this.set({
        status: 'idle',
        lastSyncedAt: now,
        lastError: null,
        lastPush:
          synced + conflicts + rejected > 0 ? { synced, conflicts, rejected } : this.state.lastPush,
      });
    } catch (err) {
      this.set({ status: 'error', lastError: err instanceof Error ? err.message : 'Sync failed' });
    }
  }

  private emitWithAck<T>(event: string, payload: unknown): Promise<T> {
    const socket = this.socket;
    if (!socket) return Promise.reject(new Error('Not connected'));
    return socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload) as Promise<T>;
  }
}

export const syncEngine = new SyncEngine();
