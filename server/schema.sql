-- Apply once with: psql "$DATABASE_URL" -f server/schema.sql
-- No passenger identity documents are stored here.
CREATE TABLE IF NOT EXISTS checkout_requests (
  idempotency_key uuid PRIMARY KEY,
  fingerprint text NOT NULL,
  state text NOT NULL DEFAULT 'creating',
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS flight_orders (
  id text PRIMARY KEY,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL CHECK (currency = 'EUR'),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_cash',
  voucher_reference text UNIQUE,
  voucher jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_events (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES flight_orders(id),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_outbox (
  order_id text PRIMARY KEY REFERENCES flight_orders(id),
  event_id text NOT NULL UNIQUE REFERENCES payment_events(id),
  state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fare_observations (
  route_key text PRIMARY KEY,
  value jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fare_observations_time ON fare_observations(observed_at);

-- Idempotent migration for delayed provider issuance.
ALTER TABLE payment_outbox ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS payment_outbox_pending ON payment_outbox(state,next_attempt_at);

-- Passenger/contact data are encrypted with AES-256-GCM before insertion.
CREATE TABLE IF NOT EXISTS low_cost_bookings (
  id text PRIMARY KEY,
  idempotency_key uuid UNIQUE NOT NULL,
  fingerprint text NOT NULL,
  provider text NOT NULL,
  state text NOT NULL,
  encrypted_payload jsonb NOT NULL,
  handoff_url text,
  booking_reference text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS low_cost_bookings_queue ON low_cost_bookings(state,created_at);

-- Additive hardening: preserve existing orders and require explicit provider proof.
ALTER TABLE flight_orders ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'unknown';
ALTER TABLE flight_orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE flight_orders ADD COLUMN IF NOT EXISTS ticket jsonb;
CREATE TABLE IF NOT EXISTS payment_attempts (
  order_id text PRIMARY KEY REFERENCES flight_orders(id),
  idempotency_key text NOT NULL UNIQUE,
  payment_id text UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL,
  livemode boolean NOT NULL,
  state text NOT NULL DEFAULT 'creating',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Inbox includes unknown orders and unexpected receipts, without passenger data.
CREATE TABLE IF NOT EXISTS payment_receipts (
  event_key text PRIMARY KEY,
  provider text NOT NULL,
  payment_id text NOT NULL,
  order_id text,
  amount_cents integer NOT NULL,
  currency text NOT NULL,
  result text NOT NULL,
  paid_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_receipts_payment ON payment_receipts(provider,payment_id);
ALTER TABLE payment_outbox ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'verify_order';
ALTER TABLE payment_outbox ADD COLUMN IF NOT EXISTS claim_token text;
ALTER TABLE payment_outbox ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE payment_outbox ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE payment_outbox ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS order_recovery (
  order_id text PRIMARY KEY,
  kind text NOT NULL,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS worker_heartbeat (
  name text PRIMARY KEY,
  started_at timestamptz NOT NULL,
  completed_at timestamptz
);
-- Existing holds have durable provenance in the saved checkout response.
-- Never infer a supplier from an order ID prefix.
UPDATE flight_orders SET provider='duffel'
WHERE provider='unknown' AND id IN (
  SELECT response->>'id' FROM checkout_requests
  WHERE state='held' AND response->>'simulation'='false'
);
