-- ═══════════════════════════════════════════════════════════════════════════
-- Ungana captive portal — PostgreSQL schema
--
-- Tracks activator (referral agent) details and every client session issued
-- through the portal, so payments and access can be looked up and reported
-- on after the fact (support, reconciliation, commission payouts). This
-- replaces the in-memory `pendingPayments` Map used in the reference
-- example-backend.js with durable, queryable storage.
--
-- Apply with:  psql "$DATABASE_URL" -f backend/src/db/schema.sql
-- or:          npm run db:migrate   (from backend/)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Packages ─────────────────────────────────────────────────────────────
-- Admin-editable plan catalogue (mirrors PACKAGES in src/lib/data.js).
CREATE TABLE IF NOT EXISTS packages (
  id            TEXT PRIMARY KEY,               -- 'daily' | 'weekly' | 'monthly' | 'earned' ...
  label         TEXT NOT NULL,
  price_kes     NUMERIC(10,2) NOT NULL CHECK (price_kes >= 0),
  duration_secs INTEGER NOT NULL CHECK (duration_secs >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO packages (id, label, price_kes, duration_secs) VALUES
  ('daily',   'Daily',   50,  86400),
  ('weekly',  'Weekly',  250, 604800),
  ('monthly', 'Monthly', 750, 2592000),
  ('test',    'Test',    5,   300),
  ('earned',  'Earned',  0,   0)      -- duration_secs is per-session for watch & earn grants
ON CONFLICT (id) DO NOTHING;

-- ── Activators ───────────────────────────────────────────────────────────
-- Field agents who refer users and earn commission on their purchases.
CREATE TABLE IF NOT EXISTS activators (
  id              SERIAL PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,            -- 'ACT-001' — referral code / portal login id
  name            TEXT NOT NULL,
  phone           TEXT UNIQUE NOT NULL,             -- +2547XXXXXXXX, portal login identity
  pin_hash        TEXT NOT NULL,                    -- bcrypt hash of the 4-digit portal PIN
  territory       TEXT,                             -- e.g. 'Nairobi CBD'
  mpesa_number    TEXT,                             -- payout destination, if different from `phone`
  commission_rate NUMERIC(4,3) NOT NULL DEFAULT 0.200 CHECK (commission_rate BETWEEN 0 AND 1),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS activators_set_updated_at ON activators;
CREATE TRIGGER activators_set_updated_at
  BEFORE UPDATE ON activators
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_activators_status ON activators(status);

-- ── Clients ──────────────────────────────────────────────────────────────
-- One row per end-user device, keyed by MAC address — the actual identity
-- the router/captive-portal deals in. `phone` is the most recently used
-- M-Pesa number for that device (kept for reference/support lookups); it is
-- deliberately not unique since the same device may pay with different
-- numbers across sessions, and is nullable since a device may exist before
-- any payment (e.g. first portal hit).
-- `username` is a self-chosen, optional, pseudonymous handle set at
-- checkout — the recovery key for "check my session" from a browser
-- context that never saw the router's MAC redirect (e.g. Android opens
-- captive-portal logins in an isolated WebView with its own storage,
-- separate from the user's regular browser — localStorage can't bridge
-- that gap). Deliberately NOT the phone number: a public, unauthenticated
-- lookup keyed on real phone numbers would let anyone enumerate Kenyan
-- phone numbers against payment history, which phone itself must still be
-- collected for M-Pesa but should never be used for.
CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  mac_address TEXT UNIQUE NOT NULL,                 -- device identity, lower-cased
  phone       TEXT,                                 -- +254XXXXXXXXX, last used — for payment/support only, never a public lookup key
  username    TEXT UNIQUE,                          -- self-chosen recovery handle, optional
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent for databases created before `username` existed.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);

-- ── Sessions ─────────────────────────────────────────────────────────────
-- One row per access window: a payment attempt (or earned-access grant) and,
-- if it succeeds, the resulting authorised session. This is the durable
-- record `/api/verify-payment`, the payment webhooks, and the activator
-- dashboards all read/write.
CREATE TABLE IF NOT EXISTS sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference         TEXT UNIQUE NOT NULL,           -- Paystack reference / Daraja CheckoutRequestID
  client_id         INTEGER NOT NULL REFERENCES clients(id),
  client_mac        TEXT NOT NULL,
  package_id        TEXT REFERENCES packages(id),
  activator_id      INTEGER REFERENCES activators(id) ON DELETE SET NULL, -- NULL = self-onboarded
  source            TEXT NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase', 'earned')),
  amount_kes        NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_kes    NUMERIC(10,2) NOT NULL DEFAULT 0, -- amount_kes * activator.commission_rate, frozen at authorisation
  payment_provider  TEXT CHECK (payment_provider IN ('paystack', 'daraja')),
  payment_status    TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'success', 'failed')),
  -- 'paid'    = provider confirmed the charge but router authorisation hasn't
  --             succeeded yet (retried by the background sweep in server.js)
  -- 'success' = router authorisation confirmed; the session is actually active
  duration_secs     INTEGER NOT NULL CHECK (duration_secs >= 0),
  authorized_at     TIMESTAMPTZ,                    -- when UniFi/router access was actually granted
  expires_at        TIMESTAMPTZ,                    -- authorized_at + duration_secs
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS sessions_set_updated_at ON sessions;
CREATE TRIGGER sessions_set_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_sessions_client_id      ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_activator_id   ON sessions(activator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_payment_status ON sessions(payment_status);
CREATE INDEX IF NOT EXISTS idx_sessions_client_mac     ON sessions(client_mac);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at     ON sessions(expires_at);

-- ── Payment events ───────────────────────────────────────────────────────
-- Raw audit trail of every webhook/poll outcome for a session — the record
-- to pull up when a customer disputes a charge or a provider callback
-- behaves unexpectedly.
CREATE TABLE IF NOT EXISTS payment_events (
  id          BIGSERIAL PRIMARY KEY,
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,                        -- 'initiated' | 'webhook' | 'poll' | 'authorized' | 'auth_failed'
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_session_id ON payment_events(session_id);

-- ── Convenience view ─────────────────────────────────────────────────────
-- Per-activator earnings summary — the query the activator dashboard needs.
CREATE OR REPLACE VIEW activator_earnings AS
SELECT
  a.id,
  a.code,
  a.name,
  COUNT(s.id) FILTER (WHERE s.payment_status = 'success')                        AS paid_sessions,
  COALESCE(SUM(s.amount_kes)     FILTER (WHERE s.payment_status = 'success'), 0) AS gross_kes,
  COALESCE(SUM(s.commission_kes) FILTER (WHERE s.payment_status = 'success'), 0) AS commission_kes
FROM activators a
LEFT JOIN sessions s ON s.activator_id = a.id
GROUP BY a.id, a.code, a.name;
