import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateApiKey(): string {
  return `wck_live_${randomBytes(32).toString('hex')}`;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateSigningSecret(): string {
  return randomBytes(32).toString('hex');
}

export function signWebhookBody(timestamp: string, rawBody: string, signingSecret: string): string {
  return createHmac('sha256', signingSecret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
