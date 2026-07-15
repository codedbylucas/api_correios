import axios from 'axios';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { webhookEndpoints } from '../db/schema.js';
import { generateSigningSecret, signWebhookBody } from '../utils/signing.js';
import { ApiError } from '../utils/apiError.js';

export interface CreateEndpointInput {
  url: string;
  description?: string;
  headers?: Record<string, string>;
}

export interface UpdateEndpointInput {
  url?: string;
  description?: string | null;
  headers?: Record<string, string>;
  active?: boolean;
}

function omitSecret<T extends { signingSecret: string }>(endpoint: T) {
  const { signingSecret, ...rest } = endpoint;
  return rest;
}

function validateHttpsUrl(url: string) {
  if (!url || !/^https:\/\//.test(url)) {
    throw new ApiError('invalid_argument', 'url must be an HTTPS URL.');
  }
}

function validateHeaders(headers?: Record<string, string>) {
  if (!headers) return {};
  if (typeof headers !== 'object' || Array.isArray(headers)) {
    throw new ApiError('invalid_argument', 'headers must be an object.');
  }
  return headers;
}

export async function createEndpoint(input: CreateEndpointInput) {
  validateHttpsUrl(input.url);

  const signingSecret = generateSigningSecret();

  const [endpoint] = await db
    .insert(webhookEndpoints)
    .values({
      url: input.url,
      description: input.description,
      customHeaders: validateHeaders(input.headers),
      signingSecret,
    })
    .returning();

  return endpoint;
}

export async function getEndpointOrThrow(id: string) {
  const [endpoint] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, id)).limit(1);

  if (!endpoint) {
    throw new ApiError('not_found', `Endpoint ${id} not found.`);
  }

  return endpoint;
}

export async function listEndpoints() {
  const endpoints = await db.select().from(webhookEndpoints);
  return endpoints.map(omitSecret);
}

export async function getEndpointPublic(id: string) {
  const endpoint = await getEndpointOrThrow(id);
  return omitSecret(endpoint);
}

export async function updateEndpoint(id: string, input: UpdateEndpointInput) {
  await getEndpointOrThrow(id);

  const changes: Partial<typeof webhookEndpoints.$inferInsert> = { updatedAt: new Date() };
  if (input.url !== undefined) {
    validateHttpsUrl(input.url);
    changes.url = input.url;
  }
  if (input.description !== undefined) changes.description = input.description || null;
  if (input.headers !== undefined) changes.customHeaders = validateHeaders(input.headers);
  if (input.active !== undefined) {
    changes.active = Boolean(input.active);
    changes.pausedAt = input.active ? null : new Date();
    if (input.active) changes.consecutiveFailures = 0;
  }

  const [endpoint] = await db.update(webhookEndpoints).set(changes).where(eq(webhookEndpoints.id, id)).returning();
  return omitSecret(endpoint);
}

export async function setEndpointActive(id: string, active: boolean) {
  return updateEndpoint(id, { active });
}

export async function testEndpoint(id: string) {
  const endpoint = await getEndpointOrThrow(id);
  const now = new Date();
  const body = JSON.stringify({
    event_id: `test_${now.getTime()}`,
    type: 'webhook.test',
    code: 'AA000000000BR',
    carrier: 'CARRIER_CORREIOS',
    checked_at: now.toISOString(),
    payload: { test: true, message: 'Cronos Labs webhook test' },
  });
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const signature = signWebhookBody(timestamp, body, endpoint.signingSecret);

  try {
    const response = await axios.post(endpoint.url, body, {
      timeout: 10_000,
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Algorithm': 'hmac-sha256',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event-Id': `test_${now.getTime()}`,
        ...(endpoint.customHeaders as Record<string, string>),
      },
    });

    return { ok: response.status >= 200 && response.status < 300, status: response.status };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}
