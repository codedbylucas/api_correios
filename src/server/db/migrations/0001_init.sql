CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  description text,
  custom_headers jsonb NOT NULL DEFAULT '{}',
  signing_secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  consecutive_failures integer NOT NULL DEFAULT 0,
  paused_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monitoring_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  frequency_hours integer NOT NULL CHECK (frequency_hours BETWEEN 1 AND 12),
  window_hours integer,
  stop_on_delivered boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracking_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES monitoring_profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  carrier text NOT NULL DEFAULT 'CARRIER_CORREIOS',
  active boolean NOT NULL DEFAULT true,
  requests_count integer NOT NULL DEFAULT 0,
  last_payload_hash text,
  last_checked_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracking_subscriptions_endpoint_profile_code_idx UNIQUE (endpoint_id, profile_id, code)
);

CREATE INDEX IF NOT EXISTS tracking_subscriptions_due_idx
  ON tracking_subscriptions (next_check_at)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES tracking_subscriptions(id) ON DELETE CASCADE,
  code text NOT NULL,
  carrier text NOT NULL,
  checked_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  attempt integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  response_status integer,
  error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx
  ON webhook_deliveries (next_attempt_at)
  WHERE status = 'pending';
