import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const PASSWORD_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_COST);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function generateToken(prefix = 'tok'): string {
  return `${prefix}_${randomBytes(32).toString('hex')}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function addDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function addHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
