import { eq, isNull, and, not, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { apiKeys } from '../db/schema.js';
import { generateApiKey, hashApiKey } from '../utils/signing.js';
import { ApiError } from '../utils/apiError.js';

function toPublic(key: typeof apiKeys.$inferSelect) {
  const { keyHash, ...rest } = key;
  return rest;
}

function ownerFilter(ownerId: string) {
  return eq(apiKeys.ownerId, ownerId);
}

export async function listKeys(ownerId: string) {
  const keys = await db.select().from(apiKeys).where(ownerFilter(ownerId));
  return keys.map(toPublic);
}

export async function createKey(name: string, ownerId: string) {
  if (!name || typeof name !== 'string') {
    throw new ApiError('invalid_argument', 'name is required.');
  }

  const plaintext = generateApiKey();
  const [record] = await db.insert(apiKeys).values({ name, keyHash: hashApiKey(plaintext), ownerId }).returning();

  return { key: toPublic(record), plaintext };
}

export async function revokeKey(id: string, ownerId: string, requestingKeyId?: string) {
  if (requestingKeyId && id === requestingKeyId) {
    throw new ApiError('invalid_argument', 'You cannot revoke the API key used to authenticate this request.');
  }

  const [existing] = await db.select().from(apiKeys).where(and(eq(apiKeys.id, id), ownerFilter(ownerId))).limit(1);
  if (!existing) {
    throw new ApiError('not_found', `API key ${id} not found.`);
  }
  if (existing.revokedAt) {
    return toPublic(existing);
  }

  const otherActive = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(ownerFilter(ownerId), isNull(apiKeys.revokedAt), not(eq(apiKeys.id, id))))
    .limit(1);

  if (otherActive.length === 0) {
    throw new ApiError('invalid_argument', 'Cannot revoke the last active API key.');
  }

  const [revoked] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), ownerFilter(ownerId)))
    .returning();

  return toPublic(revoked);
}
