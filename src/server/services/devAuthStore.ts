import type { PublicUser } from './userService.js';

export interface DevSession {
  session: null;
  user: PublicUser;
  expiresAt: Date;
}

const store = new Map<string, DevSession>();

export function saveDevSession(tokenHash: string, session: DevSession) {
  store.set(tokenHash, session);
}

export function getDevSession(tokenHash: string): DevSession | null {
  const session = store.get(tokenHash);
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    store.delete(tokenHash);
    return null;
  }
  return session;
}

export function deleteDevSession(tokenHash: string) {
  store.delete(tokenHash);
}
