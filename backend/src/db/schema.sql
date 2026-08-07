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
  ('test',    'Test',    2,   300),
  ('earned',  'Earned',  0,   0)      -- duration_secs is per-session for watch & earn grants
ON CONFLICT (id) DO NOTHING;

-- Idempotent price correction for databases that already seeded 'test' at
-- its old price — ON CONFLICT DO NOTHING above won't touch an existing row.
UPDATE packages SET price_kes = 2 WHERE id = 'test';

-- 'earned' is a durable package_id for watch-to-earn sessions (see
-- content.js claim-earned-session), not something a client can buy —
-- GET /api/packages (the purchase-screen catalogue) should never list it.
-- Idempotent: is_active defaults to true on INSERT, so existing databases
-- need this explicit correction too.
UPDATE packages SET is_active = false WHERE id = 'earned';

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

-- ── Coordinators ─────────────────────────────────────────────────────────
-- Oversee a group of activators within a territory (dashboards, escalation
-- handling, performance tracking) — a management tier above activators,
-- not a payments participant itself.
CREATE TABLE IF NOT EXISTS coordinators (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT UNIQUE NOT NULL,            -- +2547XXXXXXXX, portal login identity
  pin_hash    TEXT NOT NULL,                    -- bcrypt hash of the portal PIN
  territory   TEXT,                             -- e.g. 'Nairobi Central'
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS coordinators_set_updated_at ON coordinators;
CREATE TRIGGER coordinators_set_updated_at
  BEFORE UPDATE ON coordinators
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_coordinators_status ON coordinators(status);

-- Which coordinator (if any) an activator reports to. Idempotent ALTER since
-- `activators` is created above, before `coordinators` exists on a fresh DB.
ALTER TABLE activators ADD COLUMN IF NOT EXISTS coordinator_id INTEGER REFERENCES coordinators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activators_coordinator_id ON activators(coordinator_id);

-- ── Admin users ──────────────────────────────────────────────────────────
-- Staff accounts for the admin panel (content management, activator/
-- coordinator account management). Deliberately separate from activators/
-- coordinators rather than a role flag on those tables — different login
-- surface, different trust level, and admins aren't referral participants.
CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                  -- bcrypt hash
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── App settings ─────────────────────────────────────────────────────────
-- Small generic key/value store for admin-tunable values that don't
-- deserve their own column/table (e.g. the Earn Free Access "Connect Now"
-- threshold) — cheaper to extend later than adding a new column per knob.
-- Values are always stored as text; each reader parses to its own type.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS app_settings_set_updated_at ON app_settings;
CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Default: 30 minutes of earned content before "Connect Now" unlocks.
INSERT INTO app_settings (key, value) VALUES ('earn_connect_threshold_secs', '1800')
ON CONFLICT (key) DO NOTHING;

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
-- `activator_id` / `activator_locked`: which activator (if any) gets
-- commission on this client's purchases — assigned once, on the first
-- purchase, and permanent from then on. `activator_locked` is a separate
-- flag (not just "is activator_id set") because self-onboarded (no
-- activator, Ungana keeps 100%) is itself a permanent assignment that must
-- also survive later purchases — activator_id staying NULL can't by itself
-- distinguish "self-onboarded, locked" from "brand new, not decided yet".
-- Without this, a returning client could switch activators (or switch to
-- self) on a later purchase to redirect/dodge commission.
CREATE TABLE IF NOT EXISTS clients (
  id               SERIAL PRIMARY KEY,
  mac_address      TEXT UNIQUE NOT NULL,                 -- device identity, lower-cased
  phone            TEXT,                                 -- +254XXXXXXXXX, last used — for payment/support only, never a public lookup key
  username         TEXT UNIQUE,                          -- self-chosen recovery handle, optional
  activator_id     INTEGER REFERENCES activators(id),     -- NULL = self-onboarded (once locked) or not yet decided
  activator_locked BOOLEAN NOT NULL DEFAULT false,        -- true once the first purchase has fixed activator_id permanently
  first_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent for databases created before these columns existed.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS activator_id INTEGER REFERENCES activators(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS activator_locked BOOLEAN NOT NULL DEFAULT false;

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
  payment_provider  TEXT CHECK (payment_provider IN ('paystack', 'daraja', 'btcpay')),
  payment_status    TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'success', 'failed')),
  -- 'paid'    = provider confirmed the charge but router authorisation hasn't
  --             succeeded yet (retried by the background sweep in server.js)
  -- 'success' = router authorisation confirmed; the session is actually active
  amount_sats       BIGINT,                          -- BTC amount charged, in satoshis — only set when payment_provider = 'btcpay'
  btc_rate_kes      NUMERIC(16,2),                    -- KES per 1 BTC at invoice-creation time — audit/reconciliation only, never used to compute anything
  duration_secs     INTEGER NOT NULL CHECK (duration_secs >= 0),
  authorized_at     TIMESTAMPTZ,                    -- when UniFi/router access was actually granted
  expires_at        TIMESTAMPTZ,                    -- authorized_at + duration_secs
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent for databases created before 'btcpay' was a valid provider —
-- CREATE TABLE IF NOT EXISTS above won't touch an already-existing table's
-- constraint, so widen it explicitly.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_payment_provider_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_payment_provider_check
  CHECK (payment_provider IN ('paystack', 'daraja', 'btcpay'));

-- Idempotent for databases created before BTC amount/rate tracking existed.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS amount_sats BIGINT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS btc_rate_kes NUMERIC(16,2);

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

-- ── Content (Earn Free Access) ──────────────────────────────────────────
-- Admin-editable catalogue behind the "Watch & Earn" screen (mirrors the
-- TL_* constants in src/lib/data.js today — this table replaces them as the
-- source of truth once the frontend is wired up in a later step).
CREATE TABLE IF NOT EXISTS content_items (
  id               SERIAL PRIMARY KEY,
  type             TEXT NOT NULL CHECK (type IN ('video', 'article', 'survey', 'lesson')),
  -- Which zone of the landing feed this shows in — an explicit admin
  -- choice, not inferred from `type` (a video isn't necessarily the hero;
  -- an article isn't necessarily "News & Stories"). 'hero' and 'survey'
  -- are each meant to hold at most one active item at a time — if more
  -- than one is marked, the frontend just shows the first by sort_order.
  section          TEXT NOT NULL DEFAULT 'whats_new',
  title            TEXT NOT NULL,
  category         TEXT,
  duration_label   TEXT,                          -- display only, e.g. '5 min'
  earn_secs        INTEGER NOT NULL CHECK (earn_secs >= 0),
  min_watch_secs   INTEGER NOT NULL DEFAULT 0 CHECK (min_watch_secs >= 0), -- real seconds the client must dwell before /complete accepts it (video/article/lesson only — irrelevant for surveys)
  img_url          TEXT,
  body_url         TEXT,                           -- video/article URL, or article body text
  survey_questions JSONB,                          -- only set when type = 'survey'
  -- How often a client can re-earn this item's reward. 'once' = today's
  -- original behaviour (forever, per client) — see content_completions'
  -- period_key for how the others (daily/weekly/monthly reset on a
  -- calendar boundary; 'session' resets whenever the client is granted a
  -- new internet session, paid or earned) are actually enforced.
  view_frequency   TEXT NOT NULL DEFAULT 'once',
  impressions      BIGINT NOT NULL DEFAULT 0,       -- times a client has opened this item in the viewer (not just completed) — POST /api/content/:id/impression
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent for databases that already had content_items before dwell-time
-- validation / section placement / view-frequency existed.
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS min_watch_secs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'whats_new';
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS view_frequency TEXT NOT NULL DEFAULT 'once';
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS impressions BIGINT NOT NULL DEFAULT 0;

ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_section_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_section_check
  CHECK (section IN ('hero', 'whats_new', 'survey', 'news', 'watch_earn'));

ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_view_frequency_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_view_frequency_check
  CHECK (view_frequency IN ('once', 'daily', 'weekly', 'monthly', 'session'));

DROP TRIGGER IF EXISTS content_items_set_updated_at ON content_items;
CREATE TRIGGER content_items_set_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_content_items_active ON content_items(is_active, sort_order);

-- survey_questions used to be a plain string[] (each question rendered with
-- a hardcoded Disagree/Neutral/Agree scale). It's now [{question, answers}]
-- with admin-defined per-question answer options. Idempotently upgrade any
-- rows still in the old shape — safe to re-run: once converted, element 0 is
-- an object, not a string, so the WHERE no longer matches.
UPDATE content_items
SET survey_questions = (
  SELECT jsonb_agg(jsonb_build_object('question', q, 'answers', '["Disagree","Neutral","Agree"]'::jsonb))
  FROM jsonb_array_elements_text(survey_questions) AS q
)
WHERE type = 'survey'
  AND jsonb_typeof(survey_questions) = 'array'
  AND jsonb_array_length(survey_questions) > 0
  AND jsonb_typeof(survey_questions -> 0) = 'string';

-- One row per client per completed item — the server-side record of what a
-- client has actually finished, replacing the client-only `completedIds`
-- Set in TimelineScreen.svelte (which resets on reload and can't be
-- trusted for reward crediting). `earn_secs` is snapshotted at completion
-- time so a later catalogue edit can't retroactively change what an
-- already-earned reward is worth — same reasoning as sessions.commission_kes
-- being frozen at authorisation. `claimed` / `claimed_session_id` track
-- whether this completion's reward has already been folded into a granted
-- session, so a client can't claim the same completion twice.
CREATE TABLE IF NOT EXISTS content_completions (
  id                 BIGSERIAL PRIMARY KEY,
  client_id          INTEGER NOT NULL REFERENCES clients(id),
  content_item_id    INTEGER NOT NULL REFERENCES content_items(id),
  earn_secs          INTEGER NOT NULL,
  response           JSONB,                        -- survey answers; null for video/article/lesson
  claimed            BOOLEAN NOT NULL DEFAULT false,
  claimed_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  -- Which "period" this completion belongs to, per the item's
  -- view_frequency at the time: 'once' (constant, so it behaves like the
  -- original forever-unique row); a date/ISO-week/year-month string for
  -- daily/weekly/monthly; or the client's session id (text) for 'session'.
  -- The client+item+period combination is what's actually unique — a new
  -- period means a fresh completion is allowed. See services/content.js
  -- getCurrentPeriodKey().
  period_key         TEXT NOT NULL DEFAULT 'once',
  completed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, content_item_id, period_key)
);

-- Idempotent for databases that already had content_completions before
-- periodic view-frequency existed — widen the old 2-column uniqueness
-- (client_id, content_item_id) to include period_key.
ALTER TABLE content_completions ADD COLUMN IF NOT EXISTS period_key TEXT NOT NULL DEFAULT 'once';
ALTER TABLE content_completions DROP CONSTRAINT IF EXISTS content_completions_client_id_content_item_id_key;
ALTER TABLE content_completions DROP CONSTRAINT IF EXISTS content_completions_client_item_period_key;
ALTER TABLE content_completions ADD CONSTRAINT content_completions_client_item_period_key
  UNIQUE (client_id, content_item_id, period_key);

CREATE INDEX IF NOT EXISTS idx_content_completions_client ON content_completions(client_id);
CREATE INDEX IF NOT EXISTS idx_content_completions_unclaimed ON content_completions(client_id) WHERE claimed = false;

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

-- Per-coordinator rollup — sums the activator_earnings of everyone reporting
-- to them, for the admin panel's coordinator performance view.
CREATE OR REPLACE VIEW coordinator_earnings AS
SELECT
  co.id,
  co.name,
  COUNT(DISTINCT a.id)                     AS activator_count,
  COALESCE(SUM(ae.paid_sessions), 0)       AS paid_sessions,
  COALESCE(SUM(ae.gross_kes), 0)           AS gross_kes,
  COALESCE(SUM(ae.commission_kes), 0)      AS commission_kes
FROM coordinators co
LEFT JOIN activators a ON a.coordinator_id = co.id
LEFT JOIN activator_earnings ae ON ae.id = a.id
GROUP BY co.id, co.name;
