/**
 * socket.ts — real-time sync transport.
 *
 * Devices authenticate with their JWT in the handshake and identify themselves
 * with their clientId. They push mutations ("mutation:push") and pull changes
 * ("sync:pull"); every merged patient is broadcast to the other devices.
 */
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { REVIEW_ROLES, SOCKET_EVENTS } from '@shared/types';
import { verifyToken, type AuthUser } from './middleware/auth';
import { processMutations, pullChanges, touchDevice } from './services/syncService';
import { setIo } from './services/events';
import { config } from './config';

const online = new Map<string, number>();

export function onlineClientIds(): Set<string> {
  return new Set([...online.entries()].filter(([, n]) => n > 0).map(([id]) => id));
}

type Ack<T> = (response: T) => void;

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins, credentials: true },
    maxHttpBufferSize: 5e6,
  });

  io.use((socket, next) => {
    try {
      const { token, clientId } = socket.handshake.auth as { token?: string; clientId?: string };
      if (!token || !clientId) return next(new Error('Authentication required'));
      socket.data.user = verifyToken(token);
      socket.data.clientId = String(clientId).slice(0, 100);
      socket.data.deviceName = String((socket.handshake.auth as { deviceName?: string }).deviceName ?? '').slice(0, 100);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as AuthUser;
    const clientId = socket.data.clientId as string;
    online.set(clientId, (online.get(clientId) ?? 0) + 1);
    if (REVIEW_ROLES.includes(user.role)) void socket.join('reviewers');
    void touchDevice({ user, clientId, deviceName: socket.data.deviceName || undefined }).catch(() => undefined);

    socket.on(SOCKET_EVENTS.push, async (data: { mutations?: unknown[] }, ack?: Ack<unknown>) => {
      try {
        const mutations = Array.isArray(data?.mutations) ? data.mutations.slice(0, 500) : [];
        const response = await processMutations(mutations, { user, clientId, exceptSocketId: socket.id });
        socket.emit(SOCKET_EVENTS.ack, {
          mutationIds: response.results.filter((r) => r.status !== 'rejected').map((r) => r.mutationId),
          results: response.results,
        });
        ack?.(response);
      } catch (err) {
        console.error('mutation:push failed', err);
        ack?.({ error: 'Sync failed on the server' });
      }
    });

    socket.on(SOCKET_EVENTS.pull, async (data: { since?: number }, ack?: Ack<unknown>) => {
      try {
        ack?.(await pullChanges(Number(data?.since ?? 0) || 0));
      } catch (err) {
        console.error('sync:pull failed', err);
        ack?.({ error: 'Pull failed on the server' });
      }
    });

    socket.on('disconnect', () => {
      online.set(clientId, Math.max(0, (online.get(clientId) ?? 1) - 1));
    });
  });

  setIo(io);
  return io;
}
