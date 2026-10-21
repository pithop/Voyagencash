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
