import { createHash } from 'node:crypto';
import { and, eq, lte, gte, isNull, or } from 'drizzle-orm';
import pLimit from 'p-limit';
import { db } from '../db/client.js';
import { trackingSubscriptions, monitoringProfiles, webhookEvents, webhookDeliveries } from '../db/schema.js';
import { trackingService } from './trackingServiceInstance.js';

const CHECK_CONCURRENCY = 3;
const DUE_BATCH_SIZE = 50;
const DELIVERED_KEYWORD = /entregue/i;

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function isDelivered(payload: any): boolean {
  const latestDescription = payload?.events?.[0]?.description;
  return typeof latestDescription === 'string' && DELIVERED_KEYWORD.test(latestDescription);
}

async function findDueSubscriptions() {
  const now = new Date();
  return db
    .select({ subscription: trackingSubscriptions, profile: monitoringProfiles })
    .from(trackingSubscriptions)
    .innerJoin(monitoringProfiles, eq(trackingSubscriptions.profileId, monitoringProfiles.id))
    .where(
      and(
        eq(trackingSubscriptions.active, true),
        lte(trackingSubscriptions.nextCheckAt, now),
        or(isNull(trackingSubscriptions.endsAt), gte(trackingSubscriptions.endsAt, now))
      )
    )
    .limit(DUE_BATCH_SIZE);
}

async function checkSubscription(subscription: typeof trackingSubscriptions.$inferSelect, profile: typeof monitoringProfiles.$inferSelect) {
  const now = new Date();
  const result = await trackingService.trackBatch([subscription.code]);
  const [trackResult] = result.results;

  if (!trackResult.ok) {
    const nextCheckAt = new Date(now.getTime() + profile.frequencyHours * 60 * 60 * 1000);
    await db
      .update(trackingSubscriptions)
      .set({ lastCheckedAt: now, nextCheckAt, updatedAt: now })
      .where(eq(trackingSubscriptions.id, subscription.id));
    return { checked: true, eventCreated: false };
  }

  const newHash = hashPayload(trackResult.data);
  const changed = newHash !== subscription.lastPayloadHash;

  if (changed) {
    const [event] = await db
      .insert(webhookEvents)
      .values({
        subscriptionId: subscription.id,
        code: subscription.code,
        carrier: subscription.carrier,
        checkedAt: now,
        payload: trackResult.data,
      })
      .returning();

    await db.insert(webhookDeliveries).values({
      eventId: event.id,
      endpointId: subscription.endpointId,
      nextAttemptAt: now,
    });
  }

  const delivered = isDelivered(trackResult.data);
  const windowEnded = subscription.endsAt !== null && now >= subscription.endsAt;
  const shouldEnd = (profile.stopOnDelivered && delivered) || windowEnded;

  await db
    .update(trackingSubscriptions)
    .set({
      lastCheckedAt: now,
      lastPayloadHash: newHash,
      requestsCount: subscription.requestsCount + 1,
      active: !shouldEnd,
      endedAt: shouldEnd ? now : null,
      nextCheckAt: shouldEnd ? subscription.nextCheckAt : new Date(now.getTime() + profile.frequencyHours * 60 * 60 * 1000),
      updatedAt: now,
    })
    .where(eq(trackingSubscriptions.id, subscription.id));

  return { checked: true, eventCreated: changed };
}

export async function runDueChecks() {
  const due = await findDueSubscriptions();
  const limit = pLimit(CHECK_CONCURRENCY);

  const outcomes = await Promise.all(
    due.map(({ subscription, profile }) =>
      limit(() =>
        checkSubscription(subscription, profile).catch((error) => {
          console.error(`[checkerService] failed to check subscription ${subscription.id}:`, error);
          return { checked: false, eventCreated: false };
        })
      )
    )
  );

  return {
    due: due.length,
    checked: outcomes.filter((o) => o.checked).length,
    eventsCreated: outcomes.filter((o) => o.eventCreated).length,
  };
}
