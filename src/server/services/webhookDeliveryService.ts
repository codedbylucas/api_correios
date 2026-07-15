import axios from 'axios';
import { and, desc, eq, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { webhookDeliveries, webhookEvents, webhookEndpoints } from '../db/schema.js';
import { signWebhookBody } from '../utils/signing.js';
import { ApiError } from '../utils/apiError.js';

const MAX_ATTEMPTS = 5;
const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 10;
const RETRY_BACKOFF_SECONDS = [30, 120, 600, 1800, 3600];
const DUE_BATCH_SIZE = 50;

const RETRYABLE_STATUSES_MEAN_RETRY = (status: number) => status === 429 || status >= 500;

async function findDueDeliveries() {
  const now = new Date();
  return db
    .select({ delivery: webhookDeliveries, event: webhookEvents, endpoint: webhookEndpoints })
    .from(webhookDeliveries)
    .innerJoin(webhookEvents, eq(webhookDeliveries.eventId, webhookEvents.id))
    .innerJoin(webhookEndpoints, eq(webhookDeliveries.endpointId, webhookEndpoints.id))
    .where(and(eq(webhookDeliveries.status, 'pending'), lte(webhookDeliveries.nextAttemptAt, now)))
    .limit(DUE_BATCH_SIZE);
}

async function pauseEndpointIfNeeded(endpoint: typeof webhookEndpoints.$inferSelect, now: Date) {
  const consecutiveFailures = endpoint.consecutiveFailures + 1;

  await db
    .update(webhookEndpoints)
    .set({
      consecutiveFailures,
      active: consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? false : endpoint.active,
      pausedAt: consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? now : endpoint.pausedAt,
      updatedAt: now,
    })
    .where(eq(webhookEndpoints.id, endpoint.id));
}

async function attemptDelivery(
  delivery: typeof webhookDeliveries.$inferSelect,
  event: typeof webhookEvents.$inferSelect,
  endpoint: typeof webhookEndpoints.$inferSelect
) {
  const now = new Date();

  if (!endpoint.active) {
    await db
      .update(webhookDeliveries)
      .set({ status: 'failed', error: 'endpoint is paused', updatedAt: now })
      .where(eq(webhookDeliveries.id, delivery.id));
    return;
  }

  const body = JSON.stringify({
    event_id: event.id,
    type: 'tracking.updated',
    code: event.code,
    carrier: event.carrier,
    checked_at: event.checkedAt.toISOString(),
    payload: event.payload,
  });

  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const signature = signWebhookBody(timestamp, body, endpoint.signingSecret);

  try {
    const response = await axios.post(endpoint.url, body, {
      timeout: DELIVERY_TIMEOUT_MS,
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Algorithm': 'hmac-sha256',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event-Id': event.id,
        'X-Webhook-Delivery-Id': delivery.id,
        ...(endpoint.customHeaders as Record<string, string>),
      },
    });

    if (response.status >= 200 && response.status < 300) {
      await db
        .update(webhookDeliveries)
        .set({ status: 'success', responseStatus: response.status, deliveredAt: now, updatedAt: now })
        .where(eq(webhookDeliveries.id, delivery.id));

      if (endpoint.consecutiveFailures > 0) {
        await db
          .update(webhookEndpoints)
          .set({ consecutiveFailures: 0, updatedAt: now })
          .where(eq(webhookEndpoints.id, endpoint.id));
      }
      return;
    }

    const shouldRetry = RETRYABLE_STATUSES_MEAN_RETRY(response.status) && delivery.attempt < MAX_ATTEMPTS;

    if (shouldRetry) {
      const nextAttemptAt = new Date(now.getTime() + RETRY_BACKOFF_SECONDS[delivery.attempt - 1] * 1000);
      await db
        .update(webhookDeliveries)
        .set({ attempt: delivery.attempt + 1, responseStatus: response.status, nextAttemptAt, updatedAt: now })
        .where(eq(webhookDeliveries.id, delivery.id));
      return;
    }

    await db
      .update(webhookDeliveries)
      .set({ status: 'failed', responseStatus: response.status, updatedAt: now })
      .where(eq(webhookDeliveries.id, delivery.id));
    await pauseEndpointIfNeeded(endpoint, now);
  } catch (error: any) {
    const shouldRetry = delivery.attempt < MAX_ATTEMPTS;

    if (shouldRetry) {
      const nextAttemptAt = new Date(now.getTime() + RETRY_BACKOFF_SECONDS[delivery.attempt - 1] * 1000);
      await db
        .update(webhookDeliveries)
        .set({ attempt: delivery.attempt + 1, error: error.message, nextAttemptAt, updatedAt: now })
        .where(eq(webhookDeliveries.id, delivery.id));
      return;
    }

    await db
      .update(webhookDeliveries)
      .set({ status: 'failed', error: error.message, updatedAt: now })
      .where(eq(webhookDeliveries.id, delivery.id));
    await pauseEndpointIfNeeded(endpoint, now);
  }
}

export async function listDeliveries(options: { endpointId?: string; limit?: number } = {}) {
  const limit = Math.min(options.limit ?? 50, 200);

  const rows = await db
    .select({ delivery: webhookDeliveries, event: webhookEvents, endpointUrl: webhookEndpoints.url })
    .from(webhookDeliveries)
    .innerJoin(webhookEvents, eq(webhookDeliveries.eventId, webhookEvents.id))
    .innerJoin(webhookEndpoints, eq(webhookDeliveries.endpointId, webhookEndpoints.id))
    .where(options.endpointId ? eq(webhookDeliveries.endpointId, options.endpointId) : undefined)
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);

  return rows.map(({ delivery, event, endpointUrl }) => ({
    id: delivery.id,
    eventId: delivery.eventId,
    endpointId: delivery.endpointId,
    endpointUrl,
    code: event.code,
    checkedAt: event.checkedAt,
    attempt: delivery.attempt,
    status: delivery.status,
    responseStatus: delivery.responseStatus,
    error: delivery.error,
    nextAttemptAt: delivery.nextAttemptAt,
    deliveredAt: delivery.deliveredAt,
    createdAt: delivery.createdAt,
  }));
}

export async function redeliver(deliveryId: string) {
  const [existing] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);

  if (!existing) {
    throw new ApiError('not_found', `Delivery ${deliveryId} not found.`);
  }

  // A redelivery is a fresh delivery of the same event, with its own retry budget.
  const [created] = await db
    .insert(webhookDeliveries)
    .values({ eventId: existing.eventId, endpointId: existing.endpointId, nextAttemptAt: new Date() })
    .returning();

  return created;
}

export async function processDueDeliveries() {
  const due = await findDueDeliveries();

  await Promise.all(
    due.map(({ delivery, event, endpoint }) =>
      attemptDelivery(delivery, event, endpoint).catch((error) =>
        console.error(`[webhookDeliveryService] unexpected failure for delivery ${delivery.id}:`, error)
      )
    )
  );

  return { processed: due.length };
}
