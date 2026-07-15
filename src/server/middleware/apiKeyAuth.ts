import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { apiKeys } from '../db/schema.js';
import { hashApiKey } from '../utils/signing.js';
import { ApiError, sendApiError } from '../utils/apiError.js';

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (scheme?.toLowerCase() !== 'apikey' || !token) {
      throw new ApiError('unauthenticated', 'Missing or malformed Authorization header. Expected "Apikey <key>".');
    }

    const keyHash = hashApiKey(token);
    const [record] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!record || record.revokedAt) {
      throw new ApiError('unauthenticated', 'Invalid API key.');
    }

    res.locals.apiKeyId = record.id;

    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, record.id))
      .catch((error) => console.error('[apiKeyAuth] failed to update last_used_at:', error));

    next();
  } catch (error) {
    sendApiError(res, error);
  }
}
