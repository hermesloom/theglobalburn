# Stripe-based financial statistics

**Date:** 2026-07-28
**Status:** Approved design, ready for planning

## Problem

The statistics page derives its money figures from `burn_memberships` rows multiplied by the configured tier prices. That is wrong in three ways:

1. It ignores refunds entirely. Memberships that were returned or transferred away have had their rows deleted, so their payments vanish from the total instead of being netted out.
2. It labels its output "before Stripe fees" and never states what those fees were. In the 2026 cycle the same 2222 SEK charge cost between 35.13 and 74.02 SEK depending on the card used — no percentage reproduces this.
3. It has no notion of the fall and spring sales, and no way to state Alversjö income separately.

The board needs a figure that can go on the **Operating income** row for the tax advisor, split by sale and with Alversjö broken out, alongside the Stripe fees that will be booked as an expense.

## Findings from the live account

Investigated read-only against `acct_19mA4pEuBjGnolU2` (Gränslandet Ideell Förening) on 2026-07-28. These shaped the design and are recorded because several are counter-intuitive.

- **36,661 charges since 2017, but Checkout Sessions only from 2025-02.** The session is the only object carrying `metadata.membership_purchase_right_id` and the product name; charges have empty metadata and no description. Nothing before 2025-02 can be attributed to a burn.
- **One Stripe account serves several projects.** 2025-cycle sessions read `"Membership for The Borderland 2025"`, 2026 ones `"Membership for The Borderland 2026"`, and four read `"... 2026 (demo)"`. Attribution must go through the purchase-right join, never through the account.
- **Fees vary per charge.** A 2222 SEK charge cost 35.13 (EEA card, ~1.5% + 1.8), 44.02, 57.35 or 74.02 SEK (international, ~3.25% + 1.8). Only `balance_transaction.fee` is authoritative.
- **Fees are partly refunded.** 332 of 827 refunds in the cycle carried a "Stripe processing fee refund" totalling −10,626.30 SEK. Net fee ≠ sum of charge fees.
- **Refund ratios are not a reliable transfer signal.** 606 refunds at exactly 97% (3% transfer fee) and 202 at exactly 50% — both are transfers; `transfer_fee_percentage` was raised from 3 to 50 manually mid-season, and the old value is not recoverable from config. Also present: 2 full refunds, 3 refunds of exactly 600 SEK (Alversjö addon only), 3 at `50% + 600`.
- **No refunds against fall-sale payments** except one, consistent with fall memberships being non-transferable.
- **The non-transferable window is not the fall sale.** `open_sale_non_transferable_starting_at/_ending_at` on the 2026 project spans 2025-11-17 16:00 → 2025-11-23 23:00, six days. It contains 2,212 of the 2,449 fall payments; the remaining 237 ran to 2025-12-07.
- **`burn_membership_transfers` is incomplete.** Its earliest row is 2026-03-14, but transfers happened from the fall sale onwards.
- One dispute (2,222 SEK plus a 200 SEK dispute fee), 5 payouts, and a ±500 SEK pair of balance transfers sit outside membership payments.
- Cycle totals for reference: gross paid 13,656,196 SEK, refunded 1,518,947.48 SEK, Stripe fees 253,923.22 SEK, fee refunds −10,626.30 SEK.

## Scope

In scope: mirror tables for Stripe objects, a resumable sync triggered from the burn's admin config page, a derived view computing per-payment attribution, a financial section on the statistics page, and a one-off backfill of `burn_membership_transfers`.

Out of scope: changing how memberships are sold or refunded; any write to Stripe; reporting for pre-2025-02 charges; multi-currency (the account is SEK-only, but amounts are stored per-currency so this is not baked in).

## Data model

Six mirror tables plus a run log. Amounts are stored in **Stripe minor units** (`bigint`, öre) exactly as the API returns them; conversion to display units happens in the API layer. No `raw jsonb` column — typed columns only, which keeps the whole mirror around 25 MB.

Rows are keyed by Stripe object id and carry `stripe_account_id`, not `project_id`: Stripe objects belong to an account, and one account serves several burns. Project attribution is computed, not stored.

### `stripe_checkout_sessions`

`id text primary key`, `stripe_account_id text not null`, `created_at timestamptz not null`, `status text`, `payment_status text`, `amount_total bigint`, `amount_subtotal bigint`, `currency text`, `payment_intent_id text`, `customer_email text`, `membership_purchase_right_id uuid` (lifted out of `metadata` at sync time), `metadata jsonb`, `line_items jsonb` (array of `{description, amount_total, quantity}`), `synced_at timestamptz`.

Indexes on `(stripe_account_id, created_at)`, `(payment_intent_id)`, `(membership_purchase_right_id)`.

### `stripe_charges`

`id`, `stripe_account_id`, `created_at`, `payment_intent_id`, `amount`, `amount_refunded`, `amount_captured`, `currency`, `status`, `paid bool`, `refunded bool`, `disputed bool`, `balance_transaction_id`, `billing_email`, `card_country`, `card_brand`, `failure_code`, `synced_at`.

Indexes on `(payment_intent_id)`, `(balance_transaction_id)`, `(stripe_account_id, created_at)`.

### `stripe_refunds`

`id`, `stripe_account_id`, `created_at`, `charge_id`, `payment_intent_id`, `amount`, `currency`, `status`, `reason`, `balance_transaction_id`, `synced_at`. Indexes on `(payment_intent_id)`, `(charge_id)`.

### `stripe_balance_transactions`

`id`, `stripe_account_id`, `created_at`, `available_on`, `type`, `reporting_category`, `amount`, `fee`, `net`, `currency`, `source_id`, `fee_details jsonb`, `synced_at`. Indexes on `(source_id)`, `(stripe_account_id, created_at)`, `(type)`.

### `stripe_disputes`

`id`, `stripe_account_id`, `created_at`, `charge_id`, `payment_intent_id`, `amount`, `currency`, `status`, `reason`, `is_charge_refundable bool`, `balance_transaction_ids text[]`, `synced_at`.

### `stripe_payouts`

`id`, `stripe_account_id`, `created_at`, `arrival_date`, `amount`, `currency`, `status`, `method`, `description`, `synced_at`.

### `stripe_sync_runs`

`id uuid primary key`, `project_id uuid references projects`, `stripe_account_id text`, `mode text` (`full` | `incremental`), `started_at`, `finished_at`, `status text` (`running` | `completed` | `failed`), `cursors jsonb`, `counts jsonb`, `error text`.

### Access control

All seven tables have RLS enabled with **no policies**. Every API route already builds its Supabase client with the service role key (`utils/supabase/server.ts`), so server-side reads work and direct client access is impossible. This matters: `stripe_charges.billing_email` and `stripe_checkout_sessions.customer_email` are personal data, and the statistics page is visible to every member. The statistics endpoint returns aggregates only — never per-payment rows.

## Sync

`POST /api/burn/[slug]/admin/stripe-sync`, restricted to `BurnRole.Admin`, using the project's `burn_config.stripe_secret_api_key`.

The route has no `maxDuration` override anywhere in the repo, so it runs under Vercel's ~15s default. A full sync is roughly 90k objects across 900 API pages — about three minutes. The sync is therefore **chunked and resumable**:

- A run is a `stripe_sync_runs` row holding a per-resource cursor.
- Each POST picks up the caller's in-progress run (or starts one), works to a wall-clock budget of ~10 seconds, upserts every page it completed, saves its cursors, and returns `{runId, done: false, progress: {...}}`.
- The admin page calls the endpoint in a loop until `done: true`, rendering progress per resource.
- Resources are processed in order: checkout sessions → charges → refunds → balance transactions → disputes → payouts.

**Scope:** `created[gte] = 2025-02-01`, the first month in which Checkout Sessions exist. Earlier objects carry no metadata and could never be attributed to a burn.

**Modes.** `full` re-fetches from 2025-02-01. `incremental` (the default) fetches from `last successful run − 7 days`, then additionally refreshes by id any charge referenced by a refund or dispute synced in this run — `charge.amount_refunded` mutates long after `created`, so a pure `created`-window sync would leave stale charges behind.

Both modes upsert by primary key and are safe to re-run. A run that fails mid-way leaves its cursors in place; the next POST resumes from them.

Rate limits are not a concern (Stripe allows 100 read requests/second in live mode; this sync peaks around 10).

## Derived view

A regular SQL view `stripe_membership_payments`, one row per **paid** checkout session. Not materialised: it depends on `burn_config` values (prices, event date) that change without a sync, and 13k rows makes recomputation free.

Joins: session → charge (on `payment_intent_id`, succeeded only) → balance transaction (fee) → refunds aggregated by `payment_intent_id` → their balance transactions (fee refunds) → disputes → `burn_membership_purchase_rights` (on `membership_purchase_right_id`) → `projects` / `burn_config`.

Computed columns:

- **`project_id`** — from the purchase right. Sessions whose purchase right is missing (the four demo rows, and any orphan) get `null` and are excluded from all per-project figures, but counted in the reconciliation block.
- **`sale`** — `fall` if the session was paid before 1 January of the event year, `spring` otherwise. Event year is the year of `burn_config.event_end_date`; the boundary is evaluated in Europe/Stockholm. The 3-month gap in the data (last fall payment 2025-12-07, first spring payment 2026-03-01) makes the exact instant immaterial.
- **`alversjo_amount`** — the Alversjö addon price from `burn_config.membership_addons` when the purchase right's `metadata.enabled_addons` includes `alversjo-membership`, else 0. **`base_amount`** = `amount_total − alversjo_amount`.
- **`refunded_total`**, and its split: a refund whose amount equals `alversjo_amount` exactly is attributed wholly to Alversjö; every other refund is split proportionally by `alversjo_amount / amount_total`. This is the "exact-match first, then proportional" rule and it handles the three 600 SEK Alversjö-only refunds correctly.
- **`fee`**, **`fee_refunded`**, **`net_fee`** = `fee + fee_refunded` (fee refunds are negative). The fee is split between base and Alversjö **proportionally by amount share** in all cases.
- **`disputed_amount`** and **`dispute_fee`**, deducted from the sale the original payment belongs to.
- **`net_amount`** = `amount_total − refunded_total − disputed_amount`.

## Statistics page

A new financial section on `/burn/[slug]/statistics`, visible to every member as the existing income figure already is, fed by `GET /api/burn/[slug]/statistics/finances`.

| | Fall sale | Spring sale | Total |
|---|---|---|---|
| Membership income (excl. Alversjö) | | | |
| Alversjö income | | | |
| **Operating income** (payments − refunds) | | | |
| Stripe fees (net of fee refunds) | | | |
| Net after fees | | | |
| Payments | | | |
| Refunds | | | |
| Membership transfers | | | |

Gross and net are both shown and explicitly labelled, so the advisor can take whichever they need. The first two rows sum to operating income, so Alversjö is a visible slice rather than a parallel total.

Below it, a **reconciliation block**, because the sale rows will not match a bank statement:

- Sum of the sale rows
- Payments with no resolvable project (the demo sessions and any orphan)
- Disputes and dispute fees
- Non-payment balance transactions in the period (the ±500 SEK transfers, adjustments)
- **Total net movement across all balance transactions in the period excluding payouts**, and the residual against the sum above — which should be zero. Payouts are excluded because they move already-counted money to the bank rather than representing income; they are listed separately as a "paid out to bank" line for orientation.

A footer states the last successful sync time and warns when it is more than 24 hours old.

The transfer count comes from `burn_membership_transfers`, joined to the sale of the original membership via `original_membership_json.stripe_payment_intent_id` → session → `sale`. This requires the backfill below to have run.

## Transfer backfill

`burn_membership_transfers` only starts at 2026-03-14, so fall-era and early-spring transfers are missing. A one-off script reconstructs them.

Add a `metadata jsonb` column to `burn_membership_transfers` so reconstructed rows are distinguishable (`{"reconstructed": true}`).

Algorithm, per candidate:

1. From the mirror, take every payment intent with succeeded refunds where the refunded total is less than the original amount and is not exactly `alversjo_amount` — a partial, non-addon-only refund.
2. `from_owner_id` ← session `membership_purchase_right_id` → `burn_membership_purchase_rights.owner_id`.
3. `to_owner_id` ← the `burn_memberships` row in the same project created within ±10 seconds of the refund. The webhook creates the new membership and issues the refund in one request, so the timestamps are adjacent. Matched 1:1, nearest first, each membership consumed once.
4. `refund_amount` and `price_currency` come from the actual refund; `original_membership_json` is reconstructed from the purchase right and session as `{stripe_payment_intent_id, first_name, last_name, birthdate, price, price_currency, metadata}`. It is a partial reconstruction and is marked as such.

**Validation gate.** Before inserting anything, the same algorithm runs over the period *after* 2026-03-14, where the table already holds the truth, and its output is compared row by row on `from_owner_id`, `to_owner_id` and `refund_amount`. The backfill only proceeds on an exact match. Any mismatch is reported and stops the run.

Candidates that cannot be resolved — most likely where the receiving membership was itself later transferred away and deleted — are **reported, not guessed**. The script prints them and inserts nothing for them.

The script is idempotent: it skips candidates whose payment intent already appears in an existing row.

## Error handling

- A sync run that throws records the error on `stripe_sync_runs` and leaves cursors intact; the admin page shows the message and offers to resume.
- A missing or invalid `stripe_secret_api_key` fails the sync endpoint with a clear message rather than a Stripe stack trace.
- The statistics endpoint works with no sync data at all: it returns zeros and the UI shows "never synced" instead of an error.
- Sessions with no resolvable purchase right never break a query; they fall into the reconciliation block.

## Testing

- Unit tests for the attribution logic against fixtures drawn from the real shapes found above: the 600 SEK Alversjö-only refund, the `50% + 600` refund, the 97% and 50% transfer refunds, the full refund, the disputed charge, an international-card fee and an EEA-card fee.
- Unit tests for the fall/spring boundary either side of new year, and for a session whose purchase right is missing.
- A sync test against recorded Stripe fixtures asserting resumability: interrupting after a page and resuming produces the same rows as an uninterrupted run.
- The backfill's validation gate is itself the test that matters, and it runs against production data before any insert.
- End-to-end check: the reconciliation residual is zero for the 2026 cycle.

## Notes

`.env` (production) and `.env.local` were pulled with `vercel env pull` and are gitignored. There is no `SUPABASE_DB_URL`, so `npm run supabase:sql` will not work; DB access during development goes through `SUPABASE_SERVICE_ROLE_KEY` and the REST API.
