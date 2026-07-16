import { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { apiKeys } from '../db/schema.js';
import { hashApiKey } from '../utils/signing.js';
import { ApiError, sendApiError } from '../utils/apiError.js';

export async function apiKeyOrSession(req: Request, res: Response, next: NextFunction) {
  if (res.locals.user) return next();

  try {
    const header = req.header('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'apikey' || !token) {
      throw new ApiError('unauthenticated', 'Authentication required. Provide a session or an "Authorization: Apikey <key>" header.');
    }

    const keyHash = hashApiKey(token);
    const [record] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);

    if (!record || record.revokedAt || !record.ownerId) {
      throw new ApiError('unauthenticated', 'Invalid API key.');
    }

    res.locals.user = { id: record.ownerId };
    res.locals.apiKeyId = record.id;

    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, record.id))
      .catch((error) => console.error('[apiKeyOrSession] failed to update last_used_at:', error));

    next();
  } catch (error) {
    sendApiError(res, error);
  }
}
