-- Mirror of the Stripe objects needed for financial statistics.
--
-- Rows are keyed by Stripe object id and carry stripe_account_id, not project_id:
-- Stripe objects belong to an account, and one account serves several burns
-- (The Borderland 2025, 2026, and a demo project all share acct_19mA4pEuBjGnolU2).
-- Project attribution is computed in stripe_membership_payments, not stored here.
--
-- All amounts are Stripe minor units (öre for SEK), exactly as the API returns them.

create table stripe_checkout_sessions (
  id text primary key,
  stripe_account_id text not null,
  created_at timestamptz not null,
  status text,
  payment_status text,
  amount_total bigint,
  amount_subtotal bigint,
  currency text,
  payment_intent_id text,
  customer_email text,
  -- lifted out of metadata at sync time; the only link from Stripe back to a burn
  membership_purchase_right_id uuid,
  metadata jsonb,
  line_items jsonb,
  synced_at timestamptz not null default now()
);

create index stripe_checkout_sessions_account_created_idx
  on stripe_checkout_sessions (stripe_account_id, created_at);
create index stripe_checkout_sessions_payment_intent_idx
  on stripe_checkout_sessions (payment_intent_id);
create index stripe_checkout_sessions_purchase_right_idx
  on stripe_checkout_sessions (membership_purchase_right_id);

create table stripe_charges (
  id text primary key,
  stripe_account_id text not null,
  created_at timestamptz not null,
  payment_intent_id text,
  amount bigint,
  amount_refunded bigint,
  amount_captured bigint,
  currency text,
  status text,
  paid boolean,
  refunded boolean,
  disputed boolean,
  balance_transaction_id text,
  billing_email text,
  card_country text,
  card_brand text,
  failure_code text,
  synced_at timestamptz not null default now()
);

create index stripe_charges_payment_intent_idx on stripe_charges (payment_intent_id);
create index stripe_charges_balance_transaction_idx on stripe_charges (balance_transaction_id);
create index stripe_charges_account_created_idx on stripe_charges (stripe_account_id, created_at);

create table stripe_refunds (
  id text primary key,
  stripe_account_id text not null,
  created_at timestamptz not null,
  charge_id text,
  payment_intent_id text,
  amount bigint,
  currency text,
  status text,
  reason text,
  balance_transaction_id text,
  synced_at timestamptz not null default now()
);

create index stripe_refunds_payment_intent_idx on stripe_refunds (payment_intent_id);
create index stripe_refunds_charge_idx on stripe_refunds (charge_id);
create index stripe_refunds_account_created_idx on stripe_refunds (stripe_account_id, created_at);

create table stripe_balance_transactions (
  id text primary key,
  stripe_account_id text not null,
  created_at timestamptz not null,
  available_on timestamptz,
  type text,
  reporting_category text,
  amount bigint,
  fee bigint,
  net bigint,
  currency text,
  source_id text,
  fee_details jsonb,
  synced_at timestamptz not null default now()
);

create index stripe_balance_transactions_source_idx on stripe_balance_transactions (source_id);
create index stripe_balance_transactions_account_created_idx
  on stripe_balance_transactions (stripe_account_id, created_at);
create index stripe_balance_transactions_type_idx on stripe_balance_transactions (type);

create table stripe_disputes (
  id text primary key,
  stripe_account_id text not null,
  created_at timestamptz not null,
  charge_id text,
  payment_intent_id text,
  amount bigint,
  currency text,
  status text,
  reason text,
  is_charge_refundable boolean,
  balance_transaction_ids text[],
  synced_at timestamptz not null default now()
);

create index stripe_disputes_charge_idx on stripe_disputes (charge_id);

create table stripe_payouts (
  id text primary key,
  stripe_account_id text not null,
  created_at timestamptz not null,
  arrival_date timestamptz,
  amount bigint,
  currency text,
  status text,
  method text,
  description text,
  synced_at timestamptz not null default now()
);

create index stripe_payouts_account_created_idx on stripe_payouts (stripe_account_id, created_at);

-- One row per sync run. Holds the per-resource cursors that make a run resumable
-- across several HTTP requests (Vercel's default function timeout is ~15s, while a
-- full sync is ~3 minutes of Stripe API calls).
create table stripe_sync_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects not null,
  stripe_account_id text,
  mode text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  cursors jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  error text
);

create index stripe_sync_runs_project_idx on stripe_sync_runs (project_id, started_at desc);

-- These tables hold personal data (payer emails) and financial detail. Every API
-- route in this codebase builds its Supabase client with the service role key, which
-- bypasses RLS, so enabling RLS with no policies keeps server-side access working
-- while making direct client access impossible.
alter table stripe_checkout_sessions enable row level security;
alter table stripe_charges enable row level security;
alter table stripe_refunds enable row level security;
alter table stripe_balance_transactions enable row level security;
alter table stripe_disputes enable row level security;
alter table stripe_payouts enable row level security;
alter table stripe_sync_runs enable row level security;
