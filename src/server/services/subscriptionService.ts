import { desc, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { trackingSubscriptions } from '../db/schema.js';
import { getEndpointOrThrow } from './endpointService.js';
import { getProfileOrThrow } from './profileService.js';
import { ApiError } from '../utils/apiError.js';

const CODE_REGEX = /^[A-Z]{2}\d{9}BR$/;
const MAX_CODES = 100;

export interface UpsertSubscriptionsInput {
  endpointId: string;
  profileId: string;
  codes: string[];
}

function validateCodes(codes: unknown): string[] {
  if (!Array.isArray(codes) || codes.length === 0) {
    throw new ApiError('invalid_argument', 'codes must be a non-empty array.');
  }

  if (codes.length > MAX_CODES) {
    throw new ApiError('invalid_argument', `codes must contain at most ${MAX_CODES} items.`);
  }

  for (const code of codes) {
    if (typeof code !== 'string' || !CODE_REGEX.test(code)) {
      throw new ApiError('invalid_argument', `invalid tracking code: ${code}`);
    }
  }

  return Array.from(new Set(codes as string[]));
}

export async function upsertSubscriptions(input: UpsertSubscriptionsInput) {
  const codes = validateCodes(input.codes);

  const endpoint = await getEndpointOrThrow(input.endpointId);
  const profile = await getProfileOrThrow(input.profileId);

  const now = new Date();
  const endsAt = profile.windowHours ? new Date(now.getTime() + profile.windowHours * 60 * 60 * 1000) : null;

  const subscriptions = await db
    .insert(trackingSubscriptions)
    .values(
      codes.map((code) => ({
        endpointId: endpoint.id,
        profileId: profile.id,
        code,
        active: true,
        nextCheckAt: now,
        endsAt,
        updatedAt: now,
      }))
    )
    .onConflictDoUpdate({
      target: [trackingSubscriptions.endpointId, trackingSubscriptions.profileId, trackingSubscriptions.code],
      set: {
        active: true,
        nextCheckAt: now,
        endsAt,
        endedAt: null,
        updatedAt: now,
      },
    })
    .returning();

  return subscriptions;
}

export async function listSubscriptions(limit = 200) {
  return db
    .select()
    .from(trackingSubscriptions)
    .orderBy(desc(trackingSubscriptions.createdAt))
    .limit(limit);
}

export async function deleteSubscriptions(ids: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError('invalid_argument', 'ids must be a non-empty array.');
  }

  const result = await db
    .update(trackingSubscriptions)
    .set({ active: false, endedAt: new Date(), updatedAt: new Date() })
    .where(inArray(trackingSubscriptions.id, ids))
    .returning({ id: trackingSubscriptions.id });

  return result.length;
}
