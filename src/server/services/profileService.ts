import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { monitoringProfiles } from '../db/schema.js';
import { ApiError } from '../utils/apiError.js';

export interface CreateProfileInput {
  name: string;
  frequencyHours: number;
  windowHours?: number;
  stopOnDelivered?: boolean;
}

export async function createProfile(input: CreateProfileInput) {
  if (!input.name) {
    throw new ApiError('invalid_argument', 'name is required.');
  }

  if (!Number.isInteger(input.frequencyHours) || input.frequencyHours < 1 || input.frequencyHours > 12) {
    throw new ApiError('invalid_argument', 'frequencyHours must be an integer between 1 and 12.');
  }

  if (input.windowHours !== undefined && (!Number.isInteger(input.windowHours) || input.windowHours < 1)) {
    throw new ApiError('invalid_argument', 'windowHours must be a positive integer.');
  }

  const [profile] = await db
    .insert(monitoringProfiles)
    .values({
      name: input.name,
      frequencyHours: input.frequencyHours,
      windowHours: input.windowHours,
      stopOnDelivered: input.stopOnDelivered ?? true,
    })
    .returning();

  return profile;
}

export async function getProfileOrThrow(id: string) {
  const [profile] = await db.select().from(monitoringProfiles).where(eq(monitoringProfiles.id, id)).limit(1);

  if (!profile) {
    throw new ApiError('not_found', `Profile ${id} not found.`);
  }

  return profile;
}

export async function listProfiles() {
  return db.select().from(monitoringProfiles);
}
