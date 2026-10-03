/**
 * Real-time fan-out. The Socket.io server registers itself here so that REST
 * routes and socket handlers broadcast changes the same way.
 */
import type { Server } from 'socket.io';
import { SOCKET_EVENTS, type Conflict, type PatientDoc } from '@shared/types';

let io: Server | null = null;

export function setIo(server: Server | null): void {
  io = server;
}

export function getIo(): Server | null {
  return io;
}

/** Broadcast merged patients to every connected device except the one that sent them. */
export function broadcastPatients(patients: PatientDoc[], serverSeq: number, exceptSocketId?: string): void {
  if (!io) return;
  for (const patient of patients) {
    const target = exceptSocketId ? io.except(exceptSocketId) : io;
    target.emit(SOCKET_EVENTS.patientChanged, { patient, serverSeq });
  }
}

export function broadcastConflict(conflict: Conflict): void {
  io?.to('reviewers').emit(SOCKET_EVENTS.conflictChanged, { conflict });
}
