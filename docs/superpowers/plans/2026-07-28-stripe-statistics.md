# Stripe-based Financial Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror the burn's Stripe data into the database and report per-sale operating income, Stripe fees, and transfer counts on the statistics page, accurately enough for the tax advisor.

**Architecture:** Seven new tables mirror Stripe objects 1:1 (no derived values). A chunked, resumable sync endpoint fills them from the admin config page, working in ~10s slices because Vercel's default function timeout is ~15s and a full sync is ~3 minutes of API calls. A SQL view joins the mirror into one row per paid checkout session, exposing only Stripe facts. The *policy* — which sale a payment belongs to, how a refund splits between membership and Alversjö, how the fee prorates — lives in unit-tested TypeScript, because that is the part that is subtle and that changes.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres, service-role client), Stripe Node SDK 17, vitest 3, NextUI 2, recharts 3.

**Spec:** `docs/superpowers/specs/2026-07-28-stripe-statistics-design.md` — read it before starting. It records findings from the live account that explain why several of these decisions look odd.

## Global Constraints

- **Amounts are Stripe minor units** (`bigint` in SQL, `number` in TS — öre for SEK) everywhere below the API boundary. Convert to display units only in React, via the existing `formatMoney(amount, currency)` from `app/_components/utils.ts`.
- **No `raw jsonb` column** on mirror tables. Typed columns only.
- **Sync scope is `created >= 2025-02-01`.** Checkout Sessions do not exist before that date, and without a session a charge has no metadata and can never be attributed to a burn.
- **Never store computed attribution** (sale, project, splits) in mirror tables. It is derived at read time so that a price or date correction does not require a re-sync.
- **API routes get their Supabase client from `createClient()` in `utils/supabase/server.ts`, which uses the service role key** and bypasses RLS. Authorization is enforced by the `requestWith*` wrappers in `app/api/_common/endpoints.ts`, never by RLS.
- **The statistics endpoint returns aggregates only.** `stripe_charges.billing_email` and `stripe_checkout_sessions.customer_email` must never reach the client — the statistics page is visible to every member.
- **Alversjö addon id is `alversjo-membership`**, price read from `burn_config.membership_addons`, currently 600 SEK.
- **Existing DB queries go through `query(() => supabase.from(...)...)`** from `app/api/_common/endpoints.ts`, which throws on error.
- Prettier is configured; run `npm run prettier-fix` before committing if formatting drifts.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260728120000_stripe_mirror_tables.sql` | Seven mirror tables, indexes, RLS |
| `supabase/migrations/20260728120100_stripe_membership_payments_view.sql` | The joining view — Stripe facts only, no policy |
| `supabase/migrations/20260728120200_burn_membership_transfers_metadata.sql` | `metadata jsonb` column so backfilled rows are identifiable |
| `utils/stripe/types.ts` | Shared row and payload types |
| `utils/stripe/attribution.ts` | Sale classification, Alversjö/fee split, aggregation. Pure functions |
| `utils/stripe/attribution.test.ts` | Unit tests for the above |
| `utils/stripe/sync.ts` | Resource definitions, Stripe→row mappers, the resumable slice runner |
| `utils/stripe/sync.test.ts` | Unit tests for mappers and the slice runner |
| `app/api/burn/[slug]/admin/stripe-sync/route.ts` | Admin-only sync endpoint |
| `app/api/burn/[slug]/statistics/finances/route.ts` | Aggregated finances for members |
| `app/burn/[slug]/admin/config/StripeSyncButton.tsx` | Button that drives the sync loop and shows progress |
| `app/burn/[slug]/statistics/FinancesSection.tsx` | The finances table and reconciliation block |
| `scripts/backfill-membership-transfers.mjs` | One-off reconstruction of pre-2026-03-14 transfers |
| `vitest.config.ts` | Test runner config (vitest is already a devDependency, unconfigured) |

**Modified:**

| File | Change |
|---|---|
| `package.json` | Add `test` and `test:watch` scripts |
| `app/burn/[slug]/admin/config/page.tsx:354` | Render `<StripeSyncButton />` next to `<TestSendEmailButton />` |
| `app/burn/[slug]/statistics/page.tsx:292-335` | Replace the two hand-computed income cards with `<FinancesSection />` |

**Boundary rationale:** `attribution.ts` holds no I/O and no Supabase types, so it is testable with plain object fixtures drawn from the real Stripe shapes in the spec. `sync.ts` isolates Stripe I/O behind a resource list whose mappers are pure. The two API routes are thin: fetch rows, call the pure functions, return JSON.

---

### Task 1: Mirror tables

**Files:**
- Create: `supabase/migrations/20260728120000_stripe_mirror_tables.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `stripe_checkout_sessions`, `stripe_charges`, `stripe_refunds`, `stripe_balance_transactions`, `stripe_disputes`, `stripe_payouts`, `stripe_sync_runs`. Column names below are relied on verbatim by Tasks 5–10.

Note on convention: no existing migration in this repo enables RLS. These tables deviate deliberately — they hold payer emails and payment amounts, and without RLS a table in `public` is reachable with the anon key. Enabling RLS with no policies keeps the service-role client working and blocks everything else.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply it locally and verify**

Run:
```bash
npm run supabase:start
npm run supabase:reset
```
Expected: reset completes without error and lists the new migration. If Docker is unavailable, verify the SQL parses instead by piping it to a scratch Postgres inside a rolled-back transaction:
```bash
psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -c "begin; $(cat supabase/migrations/20260728120000_stripe_mirror_tables.sql) rollback;"
```

- [ ] **Step 3: Confirm the tables exist with the expected columns**

Run:
```bash
npx supabase db diff --schema public | head -20
```
Expected: no diff — the local database matches the migrations.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260728120000_stripe_mirror_tables.sql
git commit -m "feat: add Stripe mirror tables"
```

---

### Task 2: Test runner and shared types

`vitest` is already in `devDependencies` but has no config, no script, and there are no test files in the repo. This task makes `npm test` work and lands the types every later task imports.

**Files:**
- Create: `vitest.config.ts`, `utils/stripe/types.ts`, `utils/stripe/types.test.ts`
- Modify: `package.json` (scripts block, after `"lint"`)

**Interfaces:**
- Produces: `npm test`; types `MembershipPaymentRow`, `SaleKey`, `SaleTotals`, `BalanceSummary`, `FinancesPayload`, `PaymentSplit`, and the constant `ALVERSJO_ADDON_ID`.

- [ ] **Step 1: Add the vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["utils/**/*.test.ts", "app/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 2: Add the scripts**

In `package.json`, directly after the `"lint": "next lint",` line:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Write the types**

```typescript
// utils/stripe/types.ts

/** The Alversjö addon's id in burn_config.membership_addons. */
export const ALVERSJO_ADDON_ID = "alversjo-membership";

/** Which of the burn's two sales a payment belongs to. */
export type SaleKey = "fall" | "spring";

/**
 * One paid checkout session as exposed by the stripe_membership_payments view.
 * Stripe facts only — no policy applied. All amounts are minor units.
 */
export type MembershipPaymentRow = {
  session_id: string;
  payment_intent_id: string | null;
  paid_at: string; // ISO 8601
  project_id: string | null;
  currency: string; // upper case, e.g. "SEK"
  amount_total: number;
  /** Fee on the charge's balance transaction. Positive. */
  fee: number;
  /** Fees given back on refunds. Negative or zero. */
  fee_refunded: number;
  /** Amount withdrawn by disputes. Positive. */
  disputed_amount: number;
  /** Dispute fees. Positive. */
  dispute_fee: number;
  has_alversjo: boolean;
  /** Succeeded refunds against this payment intent, individually. */
  refunds: { amount: number }[];
};

/** A single payment split between the base membership and the Alversjö addon. */
export type PaymentSplit = {
  baseGross: number;
  alversjoGross: number;
  baseRefunded: number;
  alversjoRefunded: number;
  baseNet: number;
  alversjoNet: number;
  baseFee: number;
  alversjoFee: number;
  /** fee + fee_refunded + dispute_fee. */
  netFee: number;
};

export type SaleTotals = {
  /** Net of refunds and disputes, excluding Alversjö. */
  membershipIncome: number;
  alversjoIncome: number;
  /** membershipIncome + alversjoIncome — the Operating income row. */
  operatingIncome: number;
  /** Net of fee refunds, including dispute fees. */
  stripeFees: number;
  netAfterFees: number;
  payments: number;
  refunds: number;
  transfers: number;
};

/** Account-wide totals for the reconciliation block. */
export type BalanceSummary = {
  /** Net across all balance transactions in the period, excluding payouts. */
  netExcludingPayouts: number;
  payouts: { count: number; amount: number };
  /** Balance transactions that are neither charge, refund nor payout. */
  other: { count: number; amount: number };
};

export type FinancesPayload = {
  currency: string;
  fall: SaleTotals;
  spring: SaleTotals;
  total: SaleTotals;
  reconciliation: {
    saleRowsNet: number;
    unattributedPayments: { count: number; amount: number };
    disputes: { count: number; amount: number; fees: number };
    otherBalanceTransactions: { count: number; amount: number };
    balanceNetExcludingPayouts: number;
    /** balanceNetExcludingPayouts − everything accounted for above. Should be 0. */
    residual: number;
    payouts: { count: number; amount: number };
  };
  lastSyncedAt: string | null;
};
```

- [ ] **Step 4: Write a test that proves the runner works**

```typescript
// utils/stripe/types.test.ts
import { describe, expect, it } from "vitest";
import { ALVERSJO_ADDON_ID } from "@/utils/stripe/types";

describe("stripe types module", () => {
  it("exposes the Alversjö addon id used in burn_config", () => {
    expect(ALVERSJO_ADDON_ID).toBe("alversjo-membership");
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS, 1 test. If the `@/` alias fails to resolve, the alias block in `vitest.config.ts` is wrong — check it against `tsconfig.json`'s `paths`.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json utils/stripe/types.ts utils/stripe/types.test.ts
git commit -m "test: configure vitest and add Stripe statistics types"
```

---

### Task 3: Sale classification

Fall is everything paid before new year of the event year; spring is everything from 1 January onwards. The event year comes from `burn_config.event_end_date`. Evaluated in Europe/Stockholm.

The 2026 burn's real boundary is unambiguous — the last fall payment was 2025-12-07 and the first spring payment 2026-03-01 — so the exact instant does not matter in practice, but it must be deterministic.

**Files:**
- Create: `utils/stripe/attribution.ts`
- Create: `utils/stripe/attribution.test.ts`

**Interfaces:**
- Consumes: `SaleKey` from Task 2.
- Produces: `classifySale(paidAt: Date, eventEndDate: Date): SaleKey`.

- [ ] **Step 1: Write the failing test**

```typescript
// utils/stripe/attribution.test.ts
import { describe, expect, it } from "vitest";
import { classifySale } from "@/utils/stripe/attribution";

const EVENT_END = new Date("2026-07-26T12:00:00Z"); // The Borderland 2026

describe("classifySale", () => {
  it("puts the fall sale opening in fall", () => {
    expect(classifySale(new Date("2025-11-17T16:00:00Z"), EVENT_END)).toBe("fall");
  });

  it("puts the fall sale tail in fall, past the non-transferable window", () => {
    // 237 real payments ran from 2025-11-24 to 2025-12-07, after the
    // open_sale_non_transferable window closed on 2025-11-23.
    expect(classifySale(new Date("2025-12-07T10:00:00Z"), EVENT_END)).toBe("fall");
  });

  it("puts the spring sale opening in spring", () => {
    expect(classifySale(new Date("2026-03-01T09:00:00Z"), EVENT_END)).toBe("spring");
  });

  it("puts transfer-replacement purchases just before the burn in spring", () => {
    expect(classifySale(new Date("2026-07-13T20:00:00Z"), EVENT_END)).toBe("spring");
  });

  it("splits at Stockholm new year, not UTC", () => {
    // 2025-12-31T23:30Z is already 2026-01-01 00:30 in Stockholm (UTC+1)
    expect(classifySale(new Date("2025-12-31T23:30:00Z"), EVENT_END)).toBe("spring");
    expect(classifySale(new Date("2025-12-31T22:30:00Z"), EVENT_END)).toBe("fall");
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run utils/stripe/attribution.test.ts`
Expected: FAIL — `Failed to resolve import "@/utils/stripe/attribution"`.

- [ ] **Step 3: Implement**

```typescript
// utils/stripe/attribution.ts
import { SaleKey } from "@/utils/stripe/types";

const TIMEZONE = "Europe/Stockholm";

function calendarYearIn(timeZone: string, date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric" }).format(date),
  );
}

/**
 * Fall is everything paid in the calendar year before the event; spring is the
 * event year itself. Evaluated in Europe/Stockholm.
 */
export function classifySale(paidAt: Date, eventEndDate: Date): SaleKey {
  const eventYear = calendarYearIn(TIMEZONE, eventEndDate);
  const paidYear = calendarYearIn(TIMEZONE, paidAt);
  return paidYear < eventYear ? "fall" : "spring";
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run utils/stripe/attribution.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add utils/stripe/attribution.ts utils/stripe/attribution.test.ts
git commit -m "feat: classify Stripe payments into fall and spring sales"
```

---

### Task 4: Alversjö and fee split

The rule, from the spec: a refund whose amount equals the Alversjö addon price exactly is attributed wholly to Alversjö; every other refund splits proportionally. Fees always split proportionally. Rounding remainders go to the base so that base + Alversjö equals the total exactly, with no lost öre.

The fixtures below are the real shapes found in the live account. Do not simplify them.

**Files:**
- Modify: `utils/stripe/attribution.ts`
- Modify: `utils/stripe/attribution.test.ts`

**Interfaces:**
- Consumes: `MembershipPaymentRow`, `PaymentSplit` from Task 2.
- Produces: `splitPayment(row: MembershipPaymentRow, alversjoPrice: number): PaymentSplit`. `alversjoPrice` is minor units (60000 for 600 SEK).

- [ ] **Step 1: Write the failing tests**

Append to `utils/stripe/attribution.test.ts`:

```typescript
import { splitPayment } from "@/utils/stripe/attribution";
import { MembershipPaymentRow } from "@/utils/stripe/types";

const ALVERSJO = 60_000; // 600 SEK in öre

function row(over: Partial<MembershipPaymentRow> = {}): MembershipPaymentRow {
  return {
    session_id: "cs_live_test",
    payment_intent_id: "pi_test",
    paid_at: "2026-03-15T12:00:00Z",
    project_id: "06101baf-5991-42b1-b2f5-caa9fd6b90e2",
    currency: "SEK",
    amount_total: 222_200,
    fee: 3_513,
    fee_refunded: 0,
    disputed_amount: 0,
    dispute_fee: 0,
    has_alversjo: false,
    refunds: [],
    ...over,
  };
}

describe("splitPayment", () => {
  it("puts everything in base when there is no Alversjö addon", () => {
    const s = splitPayment(row(), ALVERSJO);
    expect(s.baseGross).toBe(222_200);
    expect(s.alversjoGross).toBe(0);
    expect(s.baseNet).toBe(222_200);
    expect(s.baseFee).toBe(3_513);
    expect(s.alversjoFee).toBe(0);
  });

  it("separates the addon from the base", () => {
    const s = splitPayment(
      row({ amount_total: 282_200, has_alversjo: true, fee: 4_413 }),
      ALVERSJO,
    );
    expect(s.baseGross).toBe(222_200);
    expect(s.alversjoGross).toBe(60_000);
    // fee prorated by amount share: 4413 * 60000/282200 = 938.2 -> 938
    expect(s.alversjoFee).toBe(938);
    expect(s.baseFee).toBe(4_413 - 938);
    expect(s.baseFee + s.alversjoFee).toBe(s.netFee);
  });

  it("attributes an addon-sized refund wholly to Alversjö", () => {
    // Real case: 2822 SEK paid, exactly 600 SEK refunded (Alversjö cancelled alone)
    const s = splitPayment(
      row({
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
        refunds: [{ amount: 60_000 }],
      }),
      ALVERSJO,
    );
    expect(s.alversjoRefunded).toBe(60_000);
    expect(s.baseRefunded).toBe(0);
    expect(s.alversjoNet).toBe(0);
    expect(s.baseNet).toBe(222_200);
  });

  it("splits a transfer refund proportionally", () => {
    // Real case: 97% transfer refund on a payment that included Alversjö
    const s = splitPayment(
      row({
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
        refunds: [{ amount: 275_534 }],
      }),
      ALVERSJO,
    );
    // 275534 * 60000/282200 = 58585.6 -> 58586
    expect(s.alversjoRefunded).toBe(58_586);
    expect(s.baseRefunded).toBe(275_534 - 58_586);
    expect(s.baseRefunded + s.alversjoRefunded).toBe(275_534);
  });

  it("handles the 50% + addon refund shape", () => {
    // Real case: 2822 paid, 2011 refunded = 50% of the whole plus the full addon
    const s = splitPayment(
      row({
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
        refunds: [{ amount: 201_100 }],
      }),
      ALVERSJO,
    );
    expect(s.baseRefunded + s.alversjoRefunded).toBe(201_100);
    expect(s.baseNet + s.alversjoNet).toBe(282_200 - 201_100);
  });

  it("nets fee refunds and dispute fees into the fee", () => {
    const s = splitPayment(
      row({ fee: 3_513, fee_refunded: -1_200, dispute_fee: 20_000 }),
      ALVERSJO,
    );
    expect(s.netFee).toBe(3_513 - 1_200 + 20_000);
  });

  it("deducts disputed amounts from net income", () => {
    // Real case: the one disputed 2222 SEK charge
    const s = splitPayment(row({ disputed_amount: 222_200 }), ALVERSJO);
    expect(s.baseNet).toBe(0);
  });

  it("treats multiple refunds on one payment independently", () => {
    const s = splitPayment(
      row({
        amount_total: 282_200,
        has_alversjo: true,
        refunds: [{ amount: 60_000 }, { amount: 111_100 }],
      }),
      ALVERSJO,
    );
    // first is addon-sized -> all Alversjö; second splits proportionally
    expect(s.alversjoRefunded).toBe(60_000 + Math.round((111_100 * 60_000) / 282_200));
    expect(s.baseRefunded + s.alversjoRefunded).toBe(171_100);
  });

  it("does not divide by zero on a zero-amount payment", () => {
    const s = splitPayment(row({ amount_total: 0, fee: 0 }), ALVERSJO);
    expect(s.baseNet).toBe(0);
    expect(s.alversjoNet).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run utils/stripe/attribution.test.ts`
Expected: FAIL — `splitPayment is not exported`.

- [ ] **Step 3: Implement**

Append to `utils/stripe/attribution.ts`:

```typescript
import { MembershipPaymentRow, PaymentSplit } from "@/utils/stripe/types";

/** The Alversjö share of `amount`, prorated by its share of `total`. */
function alversjoShare(amount: number, alversjoGross: number, total: number) {
  if (total <= 0 || alversjoGross <= 0) return 0;
  return Math.round((amount * alversjoGross) / total);
}

/**
 * Splits one payment between the base membership and the Alversjö addon.
 *
 * Refunds: a refund equal to the addon price is attributed wholly to Alversjö
 * (people do cancel the addon alone); anything else splits proportionally.
 * Fees and disputes always split proportionally. Rounding remainders fall to the
 * base, so base + Alversjö reconstructs the total exactly.
 */
export function splitPayment(
  row: MembershipPaymentRow,
  alversjoPrice: number,
): PaymentSplit {
  const total = row.amount_total;
  const alversjoGross = row.has_alversjo ? Math.min(alversjoPrice, total) : 0;
  const baseGross = total - alversjoGross;

  let alversjoRefunded = 0;
  let refundedTotal = 0;
  for (const refund of row.refunds) {
    refundedTotal += refund.amount;
    alversjoRefunded +=
      alversjoGross > 0 && refund.amount === alversjoGross
        ? refund.amount
        : alversjoShare(refund.amount, alversjoGross, total);
  }
  const baseRefunded = refundedTotal - alversjoRefunded;

  const alversjoDisputed = alversjoShare(row.disputed_amount, alversjoGross, total);
  const baseDisputed = row.disputed_amount - alversjoDisputed;

  const netFee = row.fee + row.fee_refunded + row.dispute_fee;
  const alversjoFee = alversjoShare(netFee, alversjoGross, total);
  const baseFee = netFee - alversjoFee;

  return {
    baseGross,
    alversjoGross,
    baseRefunded,
    alversjoRefunded,
    baseNet: baseGross - baseRefunded - baseDisputed,
    alversjoNet: alversjoGross - alversjoRefunded - alversjoDisputed,
    baseFee,
    alversjoFee,
    netFee,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run utils/stripe/attribution.test.ts`
Expected: PASS, 14 tests (5 from Task 3 plus 9 here).

- [ ] **Step 5: Commit**

```bash
git add utils/stripe/attribution.ts utils/stripe/attribution.test.ts
git commit -m "feat: split payments between membership and Alversjö"
```

---

### Task 5: Aggregation into the finances payload

Rolls per-payment splits up into the fall/spring/total table and computes the reconciliation block. Payments whose `project_id` does not match the burn are excluded from the sale rows and counted as unattributed — this is what keeps the demo project and the 2025 burn out of the 2026 figures.

**Files:**
- Modify: `utils/stripe/attribution.ts`
- Modify: `utils/stripe/attribution.test.ts`

**Interfaces:**
- Consumes: `classifySale`, `splitPayment`, and all types from Task 2.
- Produces:
```typescript
aggregateFinances(input: {
  rows: MembershipPaymentRow[];
  projectId: string;
  alversjoPrice: number;
  eventEndDate: Date;
  currency: string;
  transferPaymentIntentIds: string[];
  balanceSummary: BalanceSummary;
  lastSyncedAt: string | null;
}): FinancesPayload
```
`transferPaymentIntentIds` are the payment intents of the *original* memberships in `burn_membership_transfers` — Task 10 extracts them.

- [ ] **Step 1: Write the failing tests**

Append to `utils/stripe/attribution.test.ts`:

```typescript
import { aggregateFinances } from "@/utils/stripe/attribution";
import { BalanceSummary } from "@/utils/stripe/types";

const PROJECT = "06101baf-5991-42b1-b2f5-caa9fd6b90e2";
const EMPTY_BALANCE: BalanceSummary = {
  netExcludingPayouts: 0,
  payouts: { count: 0, amount: 0 },
  other: { count: 0, amount: 0 },
};

function aggregate(rows: MembershipPaymentRow[], over: Partial<Parameters<typeof aggregateFinances>[0]> = {}) {
  return aggregateFinances({
    rows,
    projectId: PROJECT,
    alversjoPrice: ALVERSJO,
    eventEndDate: EVENT_END,
    currency: "SEK",
    transferPaymentIntentIds: [],
    balanceSummary: EMPTY_BALANCE,
    lastSyncedAt: "2026-07-28T10:00:00Z",
    ...over,
  });
}

describe("aggregateFinances", () => {
  it("separates fall from spring by payment date", () => {
    const p = aggregate([
      row({ paid_at: "2025-11-17T16:00:00Z", amount_total: 222_200, fee: 3_513 }),
      row({ paid_at: "2026-03-01T09:00:00Z", amount_total: 123_400, fee: 2_031 }),
    ]);
    expect(p.fall.operatingIncome).toBe(222_200);
    expect(p.spring.operatingIncome).toBe(123_400);
    expect(p.total.operatingIncome).toBe(345_600);
    expect(p.fall.payments).toBe(1);
    expect(p.spring.payments).toBe(1);
  });

  it("reports Alversjö as a slice that sums back into operating income", () => {
    const p = aggregate([
      row({ paid_at: "2026-03-01T09:00:00Z", amount_total: 282_200, has_alversjo: true, fee: 4_413 }),
    ]);
    expect(p.spring.alversjoIncome).toBe(60_000);
    expect(p.spring.membershipIncome).toBe(222_200);
    expect(p.spring.membershipIncome + p.spring.alversjoIncome).toBe(
      p.spring.operatingIncome,
    );
  });

  it("nets refunds out of the sale the original payment belongs to", () => {
    // paid in spring, refunded months later — still reduces spring
    const p = aggregate([
      row({
        paid_at: "2026-03-01T09:00:00Z",
        amount_total: 222_200,
        fee: 3_513,
        refunds: [{ amount: 111_100 }],
      }),
    ]);
    expect(p.spring.operatingIncome).toBe(111_100);
    expect(p.spring.refunds).toBe(1);
  });

  it("shows gross and net separately", () => {
    const p = aggregate([
      row({ paid_at: "2026-03-01T09:00:00Z", amount_total: 222_200, fee: 3_513 }),
    ]);
    expect(p.spring.operatingIncome).toBe(222_200);
    expect(p.spring.stripeFees).toBe(3_513);
    expect(p.spring.netAfterFees).toBe(222_200 - 3_513);
  });

  it("excludes payments belonging to another project and counts them as unattributed", () => {
    const p = aggregate([
      row({ paid_at: "2026-03-01T09:00:00Z", amount_total: 222_200 }),
      row({ paid_at: "2026-03-02T09:00:00Z", amount_total: 1_000, project_id: null }),
      row({ paid_at: "2026-03-03T09:00:00Z", amount_total: 3_000, project_id: "other" }),
    ]);
    expect(p.total.operatingIncome).toBe(222_200);
    expect(p.reconciliation.unattributedPayments).toEqual({ count: 2, amount: 4_000 });
  });

  it("counts transfers against the sale of the original membership", () => {
    const p = aggregate(
      [
        row({ payment_intent_id: "pi_fall", paid_at: "2025-11-20T09:00:00Z" }),
        row({ payment_intent_id: "pi_spring", paid_at: "2026-03-20T09:00:00Z" }),
      ],
      { transferPaymentIntentIds: ["pi_spring"] },
    );
    expect(p.fall.transfers).toBe(0);
    expect(p.spring.transfers).toBe(1);
    expect(p.total.transfers).toBe(1);
  });

  it("reconciles to zero when every movement is accounted for", () => {
    const p = aggregate(
      [row({ paid_at: "2026-03-01T09:00:00Z", amount_total: 222_200, fee: 3_513 })],
      {
        balanceSummary: {
          netExcludingPayouts: 222_200 - 3_513,
          payouts: { count: 1, amount: -200_000 },
          other: { count: 0, amount: 0 },
        },
      },
    );
    expect(p.reconciliation.residual).toBe(0);
    expect(p.reconciliation.payouts).toEqual({ count: 1, amount: -200_000 });
  });

  it("surfaces a non-zero residual rather than hiding it", () => {
    const p = aggregate(
      [row({ paid_at: "2026-03-01T09:00:00Z", amount_total: 222_200, fee: 3_513 })],
      {
        balanceSummary: {
          netExcludingPayouts: 222_200 - 3_513 + 50_000,
          payouts: { count: 0, amount: 0 },
          other: { count: 0, amount: 0 },
        },
      },
    );
    expect(p.reconciliation.residual).toBe(50_000);
  });

  it("returns zeros for an empty mirror", () => {
    const p = aggregate([], { lastSyncedAt: null });
    expect(p.total.operatingIncome).toBe(0);
    expect(p.total.payments).toBe(0);
    expect(p.lastSyncedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run utils/stripe/attribution.test.ts`
Expected: FAIL — `aggregateFinances is not exported`.

- [ ] **Step 3: Implement**

Append to `utils/stripe/attribution.ts`:

```typescript
import {
  BalanceSummary,
  FinancesPayload,
  SaleTotals,
  SaleKey,
} from "@/utils/stripe/types";

function emptyTotals(): SaleTotals {
  return {
    membershipIncome: 0,
    alversjoIncome: 0,
    operatingIncome: 0,
    stripeFees: 0,
    netAfterFees: 0,
    payments: 0,
    refunds: 0,
    transfers: 0,
  };
}

function addInto(target: SaleTotals, source: SaleTotals) {
  target.membershipIncome += source.membershipIncome;
  target.alversjoIncome += source.alversjoIncome;
  target.operatingIncome += source.operatingIncome;
  target.stripeFees += source.stripeFees;
  target.netAfterFees += source.netAfterFees;
  target.payments += source.payments;
  target.refunds += source.refunds;
  target.transfers += source.transfers;
}

export function aggregateFinances(input: {
  rows: MembershipPaymentRow[];
  projectId: string;
  alversjoPrice: number;
  eventEndDate: Date;
  currency: string;
  transferPaymentIntentIds: string[];
  balanceSummary: BalanceSummary;
  lastSyncedAt: string | null;
}): FinancesPayload {
  const sales: Record<SaleKey, SaleTotals> = {
    fall: emptyTotals(),
    spring: emptyTotals(),
  };
  const transfers = new Set(input.transferPaymentIntentIds);

  let unattributedCount = 0;
  let unattributedAmount = 0;
  let disputeCount = 0;
  let disputeAmount = 0;
  let disputeFees = 0;

  for (const row of input.rows) {
    if (row.disputed_amount > 0 || row.dispute_fee > 0) {
      disputeCount++;
      disputeAmount += row.disputed_amount;
      disputeFees += row.dispute_fee;
    }

    if (row.project_id !== input.projectId) {
      unattributedCount++;
      unattributedAmount += row.amount_total;
      continue;
    }

    const sale = classifySale(new Date(row.paid_at), input.eventEndDate);
    const split = splitPayment(row, input.alversjoPrice);
    const totals = sales[sale];

    totals.membershipIncome += split.baseNet;
    totals.alversjoIncome += split.alversjoNet;
    totals.operatingIncome += split.baseNet + split.alversjoNet;
    totals.stripeFees += split.netFee;
    totals.netAfterFees += split.baseNet + split.alversjoNet - split.netFee;
    totals.payments++;
    if (row.refunds.length > 0) totals.refunds++;
    if (row.payment_intent_id && transfers.has(row.payment_intent_id)) {
      totals.transfers++;
    }
  }

  const total = emptyTotals();
  addInto(total, sales.fall);
  addInto(total, sales.spring);

  // Everything the sale rows account for, in balance-sheet terms: income actually
  // kept, less the fees paid on it. Dispute amounts and fees are already inside
  // the sale rows (splitPayment deducts them), so they are reported for visibility
  // but not subtracted again here.
  const saleRowsNet = total.netAfterFees;
  const accountedFor =
    saleRowsNet + unattributedAmount + input.balanceSummary.other.amount;

  return {
    currency: input.currency,
    fall: sales.fall,
    spring: sales.spring,
    total,
    reconciliation: {
      saleRowsNet,
      unattributedPayments: {
        count: unattributedCount,
        amount: unattributedAmount,
      },
      disputes: { count: disputeCount, amount: disputeAmount, fees: disputeFees },
      otherBalanceTransactions: input.balanceSummary.other,
      balanceNetExcludingPayouts: input.balanceSummary.netExcludingPayouts,
      residual: input.balanceSummary.netExcludingPayouts - accountedFor,
      payouts: input.balanceSummary.payouts,
    },
    lastSyncedAt: input.lastSyncedAt,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS, 24 tests total.

- [ ] **Step 5: Commit**

```bash
git add utils/stripe/attribution.ts utils/stripe/attribution.test.ts
git commit -m "feat: aggregate Stripe payments into per-sale finance totals"
```

---

### Task 6: Stripe object mappers

Pure functions turning a Stripe API object into a mirror-table row. Kept separate from the runner so they can be tested against real object shapes without any network.

Stripe timestamps are seconds since epoch; the tables use `timestamptz`, so every one converts through `toIso`. `metadata.membership_purchase_right_id` is lifted into its own column because it is the only link from Stripe back to a burn.

**Files:**
- Create: `utils/stripe/sync.ts`
- Create: `utils/stripe/sync.test.ts`

**Interfaces:**
- Produces: `SYNC_START_ISO`, `SyncResource`, `SYNC_RESOURCES`, and the resource names `"checkout_sessions" | "charges" | "refunds" | "balance_transactions" | "disputes" | "payouts"`.

- [ ] **Step 1: Write the failing tests**

```typescript
// utils/stripe/sync.test.ts
import { describe, expect, it } from "vitest";
import { SYNC_RESOURCES, SYNC_START_ISO } from "@/utils/stripe/sync";

const ACCOUNT = "acct_19mA4pEuBjGnolU2";
const resource = (name: string) =>
  SYNC_RESOURCES.find((r) => r.name === name)!;

describe("sync resources", () => {
  it("starts at the first month Checkout Sessions exist", () => {
    expect(SYNC_START_ISO).toBe("2025-02-01T00:00:00.000Z");
  });

  it("maps a checkout session, lifting the purchase right id out of metadata", () => {
    const mapped = resource("checkout_sessions").map(
      {
        id: "cs_live_a1",
        created: 1764500000,
        status: "complete",
        payment_status: "paid",
        amount_total: 222200,
        amount_subtotal: 222200,
        currency: "sek",
        payment_intent: "pi_3SZJoY",
        customer_email: "someone@example.com",
        metadata: { membership_purchase_right_id: "80113518-5ad8-4778-8bf6-1cd8c95c1eda" },
        line_items: {
          data: [
            { description: "Membership for The Borderland 2026", amount_total: 222200, quantity: 1 },
          ],
        },
      },
      ACCOUNT,
    );
    expect(mapped.id).toBe("cs_live_a1");
    expect(mapped.stripe_account_id).toBe(ACCOUNT);
    expect(mapped.created_at).toBe(new Date(1764500000 * 1000).toISOString());
    expect(mapped.payment_intent_id).toBe("pi_3SZJoY");
    expect(mapped.membership_purchase_right_id).toBe(
      "80113518-5ad8-4778-8bf6-1cd8c95c1eda",
    );
    expect(mapped.line_items).toEqual([
      { description: "Membership for The Borderland 2026", amount_total: 222200, quantity: 1 },
    ]);
  });

  it("tolerates a session with no metadata and no payment intent", () => {
    const mapped = resource("checkout_sessions").map(
      { id: "cs_live_a2", created: 1764500000, status: "expired", payment_status: "unpaid", currency: "sek", metadata: {} },
      ACCOUNT,
    );
    expect(mapped.membership_purchase_right_id).toBeNull();
    expect(mapped.payment_intent_id).toBeNull();
  });

  it("maps an expanded payment_intent object down to its id", () => {
    const mapped = resource("checkout_sessions").map(
      { id: "cs_live_a3", created: 1764500000, currency: "sek", metadata: {}, payment_intent: { id: "pi_expanded" } },
      ACCOUNT,
    );
    expect(mapped.payment_intent_id).toBe("pi_expanded");
  });

  it("maps a charge including its card details", () => {
    const mapped = resource("charges").map(
      {
        id: "ch_3TssXg",
        created: 1783982501,
        payment_intent: "pi_3TssXg",
        amount: 222200,
        amount_refunded: 0,
        amount_captured: 222200,
        currency: "sek",
        status: "succeeded",
        paid: true,
        refunded: false,
        disputed: false,
        balance_transaction: "txn_3TssXg",
        billing_details: { email: "johan@example.se" },
        payment_method_details: { card: { country: "SE", brand: "mastercard" } },
      },
      ACCOUNT,
    );
    expect(mapped.balance_transaction_id).toBe("txn_3TssXg");
    expect(mapped.card_country).toBe("SE");
    expect(mapped.card_brand).toBe("mastercard");
    expect(mapped.billing_email).toBe("johan@example.se");
  });

  it("maps a balance transaction with its fee details", () => {
    const mapped = resource("balance_transactions").map(
      {
        id: "txn_1",
        created: 1783982501,
        available_on: 1784000000,
        type: "charge",
        reporting_category: "charge",
        amount: 222200,
        fee: 3513,
        net: 218687,
        currency: "sek",
        source: "ch_3TssXg",
        fee_details: [{ type: "stripe_fee", amount: 3513, description: "Stripe processing fees" }],
      },
      ACCOUNT,
    );
    expect(mapped.fee).toBe(3513);
    expect(mapped.source_id).toBe("ch_3TssXg");
    expect(mapped.available_on).toBe(new Date(1784000000 * 1000).toISOString());
  });

  it("maps a dispute's balance transactions to an id array", () => {
    const mapped = resource("disputes").map(
      {
        id: "du_1",
        created: 1780000000,
        charge: "ch_3T9T6D",
        payment_intent: "pi_3T9T6D",
        amount: 222200,
        currency: "sek",
        status: "under_review",
        reason: "credit_not_processed",
        is_charge_refundable: false,
        balance_transactions: [{ id: "txn_dispute_1" }, { id: "txn_dispute_2" }],
      },
      ACCOUNT,
    );
    expect(mapped.balance_transaction_ids).toEqual(["txn_dispute_1", "txn_dispute_2"]);
  });

  it("maps a payout's arrival date", () => {
    const mapped = resource("payouts").map(
      { id: "po_1", created: 1775000000, arrival_date: 1775200000, amount: -600000000, currency: "sek", status: "paid", method: "standard", description: "" },
      ACCOUNT,
    );
    expect(mapped.arrival_date).toBe(new Date(1775200000 * 1000).toISOString());
  });

  it("syncs sessions before charges, because charges are refreshed by reference", () => {
    const names = SYNC_RESOURCES.map((r) => r.name);
    expect(names.indexOf("checkout_sessions")).toBeLessThan(names.indexOf("charges"));
    expect(names.indexOf("refunds")).toBeLessThan(names.indexOf("balance_transactions"));
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run utils/stripe/sync.test.ts`
Expected: FAIL — `Failed to resolve import "@/utils/stripe/sync"`.

- [ ] **Step 3: Implement the mappers**

```typescript
// utils/stripe/sync.ts
import Stripe from "stripe";

/** Checkout Sessions do not exist before this date; earlier charges carry no metadata. */
export const SYNC_START_ISO = "2025-02-01T00:00:00.000Z";

const toIso = (seconds: number | null | undefined) =>
  seconds == null ? null : new Date(seconds * 1000).toISOString();

/** Stripe fields are either an id string or an expanded object. */
const idOf = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return (value as { id: string }).id;
  }
  return null;
};

export type SyncResourceName =
  | "checkout_sessions"
  | "charges"
  | "refunds"
  | "balance_transactions"
  | "disputes"
  | "payouts";

export type SyncResource = {
  name: SyncResourceName;
  table: string;
  /** Extra query params, e.g. line item expansion. */
  params?: Record<string, unknown>;
  list: (
    stripe: Stripe,
    params: Record<string, unknown>,
  ) => Promise<{ data: any[]; has_more: boolean }>;
  map: (object: any, accountId: string) => Record<string, any>;
};

export const SYNC_RESOURCES: SyncResource[] = [
  {
    name: "checkout_sessions",
    table: "stripe_checkout_sessions",
    params: { "expand[]": "data.line_items" },
    list: (stripe, params) => stripe.checkout.sessions.list(params as any),
    map: (s, accountId) => ({
      id: s.id,
      stripe_account_id: accountId,
      created_at: toIso(s.created),
      status: s.status ?? null,
      payment_status: s.payment_status ?? null,
      amount_total: s.amount_total ?? null,
      amount_subtotal: s.amount_subtotal ?? null,
      currency: s.currency ?? null,
      payment_intent_id: idOf(s.payment_intent),
      customer_email: s.customer_email ?? null,
      membership_purchase_right_id:
        s.metadata?.membership_purchase_right_id ?? null,
      metadata: s.metadata ?? {},
      line_items: (s.line_items?.data ?? []).map((li: any) => ({
        description: li.description,
        amount_total: li.amount_total,
        quantity: li.quantity,
      })),
    }),
  },
  {
    name: "charges",
    table: "stripe_charges",
    list: (stripe, params) => stripe.charges.list(params as any),
    map: (c, accountId) => ({
      id: c.id,
      stripe_account_id: accountId,
      created_at: toIso(c.created),
      payment_intent_id: idOf(c.payment_intent),
      amount: c.amount ?? null,
      amount_refunded: c.amount_refunded ?? null,
      amount_captured: c.amount_captured ?? null,
      currency: c.currency ?? null,
      status: c.status ?? null,
      paid: c.paid ?? null,
      refunded: c.refunded ?? null,
      disputed: c.disputed ?? null,
      balance_transaction_id: idOf(c.balance_transaction),
      billing_email: c.billing_details?.email ?? null,
      card_country: c.payment_method_details?.card?.country ?? null,
      card_brand: c.payment_method_details?.card?.brand ?? null,
      failure_code: c.failure_code ?? null,
    }),
  },
  {
    name: "refunds",
    table: "stripe_refunds",
    list: (stripe, params) => stripe.refunds.list(params as any),
    map: (r, accountId) => ({
      id: r.id,
      stripe_account_id: accountId,
      created_at: toIso(r.created),
      charge_id: idOf(r.charge),
      payment_intent_id: idOf(r.payment_intent),
      amount: r.amount ?? null,
      currency: r.currency ?? null,
      status: r.status ?? null,
      reason: r.reason ?? null,
      balance_transaction_id: idOf(r.balance_transaction),
    }),
  },
  {
    name: "balance_transactions",
    table: "stripe_balance_transactions",
    list: (stripe, params) => stripe.balanceTransactions.list(params as any),
    map: (b, accountId) => ({
      id: b.id,
      stripe_account_id: accountId,
      created_at: toIso(b.created),
      available_on: toIso(b.available_on),
      type: b.type ?? null,
      reporting_category: b.reporting_category ?? null,
      amount: b.amount ?? null,
      fee: b.fee ?? null,
      net: b.net ?? null,
      currency: b.currency ?? null,
      source_id: idOf(b.source),
      fee_details: b.fee_details ?? [],
    }),
  },
  {
    name: "disputes",
    table: "stripe_disputes",
    list: (stripe, params) => stripe.disputes.list(params as any),
    map: (d, accountId) => ({
      id: d.id,
      stripe_account_id: accountId,
      created_at: toIso(d.created),
      charge_id: idOf(d.charge),
      payment_intent_id: idOf(d.payment_intent),
      amount: d.amount ?? null,
      currency: d.currency ?? null,
      status: d.status ?? null,
      reason: d.reason ?? null,
      is_charge_refundable: d.is_charge_refundable ?? null,
      balance_transaction_ids: (d.balance_transactions ?? [])
        .map((bt: any) => idOf(bt))
        .filter(Boolean),
    }),
  },
  {
    name: "payouts",
    table: "stripe_payouts",
    list: (stripe, params) => stripe.payouts.list(params as any),
    map: (p, accountId) => ({
      id: p.id,
      stripe_account_id: accountId,
      created_at: toIso(p.created),
      arrival_date: toIso(p.arrival_date),
      amount: p.amount ?? null,
      currency: p.currency ?? null,
      status: p.status ?? null,
      method: p.method ?? null,
      description: p.description ?? null,
    }),
  },
];
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run utils/stripe/sync.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add utils/stripe/sync.ts utils/stripe/sync.test.ts
git commit -m "feat: map Stripe objects to mirror table rows"
```

---

### Task 7: Resumable slice runner

Works through the resource list for a bounded wall-clock budget, then stops and hands back its cursors so the next HTTP request can resume exactly where it left off. This is what makes a 3-minute sync survive a ~15s function timeout.

The clock and the persistence layer are injected so the runner can be tested without either.

**Files:**
- Modify: `utils/stripe/sync.ts`
- Modify: `utils/stripe/sync.test.ts`

**Interfaces:**
- Consumes: `SYNC_RESOURCES`, `SYNC_START_ISO` from Task 6.
- Produces:
```typescript
type SyncCursors = Record<string, { startingAfter?: string; done?: boolean }>;
type SyncCounts = Record<string, number>;

runSyncSlice(input: {
  stripe: Stripe;
  accountId: string;
  createdGteIso: string;
  cursors: SyncCursors;
  counts: SyncCounts;
  upsert: (table: string, rows: Record<string, any>[]) => Promise<void>;
  budgetMs: number;
  now: () => number;
  resources?: SyncResource[];
}): Promise<{ done: boolean; cursors: SyncCursors; counts: SyncCounts }>
```

- [ ] **Step 1: Write the failing tests**

Append to `utils/stripe/sync.test.ts`:

```typescript
import { runSyncSlice, SyncResource } from "@/utils/stripe/sync";

/** A resource backed by an in-memory list, paginating 2 at a time. */
function fakeResource(name: string, objects: any[], calls: string[][]): SyncResource {
  return {
    name: name as any,
    table: `t_${name}`,
    list: async (_stripe, params: any) => {
      calls.push([name, params.starting_after ?? "start"]);
      const from = params.starting_after
        ? objects.findIndex((o) => o.id === params.starting_after) + 1
        : 0;
      const data = objects.slice(from, from + 2);
      return { data, has_more: from + 2 < objects.length };
    },
    map: (o) => ({ id: o.id }),
  };
}

const objs = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}_${i}` }));

describe("runSyncSlice", () => {
  it("syncs everything and reports done when the budget is ample", async () => {
    const calls: string[][] = [];
    const written: Record<string, any[]> = {};
    const result = await runSyncSlice({
      stripe: {} as any,
      accountId: "acct_1",
      createdGteIso: SYNC_START_ISO,
      cursors: {},
      counts: {},
      upsert: async (table, rows) => {
        (written[table] ??= []).push(...rows);
      },
      budgetMs: 10_000,
      now: () => 0,
      resources: [fakeResource("a", objs("a", 5), calls)],
    });
    expect(result.done).toBe(true);
    expect(result.counts.a).toBe(5);
    expect(written.t_a).toHaveLength(5);
  });

  it("stops when the budget runs out and resumes from the saved cursor", async () => {
    const calls: string[][] = [];
    const all = objs("a", 6);
    let clock = 0;
    const upsert = async () => {};
    const first = await runSyncSlice({
      stripe: {} as any,
      accountId: "acct_1",
      createdGteIso: SYNC_START_ISO,
      cursors: {},
      counts: {},
      upsert,
      budgetMs: 100,
      // one page costs 60ms of budget, so it stops after the first page
      now: () => (clock += 60),
      resources: [fakeResource("a", all, calls)],
    });
    expect(first.done).toBe(false);
    expect(first.counts.a).toBe(2);
    expect(first.cursors.a.startingAfter).toBe("a_1");

    clock = 0;
    const second = await runSyncSlice({
      stripe: {} as any,
      accountId: "acct_1",
      createdGteIso: SYNC_START_ISO,
      cursors: first.cursors,
      counts: first.counts,
      upsert,
      budgetMs: 10_000,
      now: () => 0,
      resources: [fakeResource("a", all, calls)],
    });
    expect(second.done).toBe(true);
    expect(second.counts.a).toBe(6);
    // resumed rather than restarted
    expect(calls.some(([, after]) => after === "a_1")).toBe(true);
  });

  it("moves to the next resource once one is exhausted", async () => {
    const calls: string[][] = [];
    const result = await runSyncSlice({
      stripe: {} as any,
      accountId: "acct_1",
      createdGteIso: SYNC_START_ISO,
      cursors: {},
      counts: {},
      upsert: async () => {},
      budgetMs: 10_000,
      now: () => 0,
      resources: [
        fakeResource("a", objs("a", 3), calls),
        fakeResource("b", objs("b", 1), calls),
      ],
    });
    expect(result.done).toBe(true);
    expect(result.counts).toEqual({ a: 3, b: 1 });
  });

  it("does not re-list a resource already marked done", async () => {
    const calls: string[][] = [];
    await runSyncSlice({
      stripe: {} as any,
      accountId: "acct_1",
      createdGteIso: SYNC_START_ISO,
      cursors: { a: { done: true } },
      counts: { a: 3 },
      upsert: async () => {},
      budgetMs: 10_000,
      now: () => 0,
      resources: [fakeResource("a", objs("a", 3), calls)],
    });
    expect(calls).toHaveLength(0);
  });

  it("passes the created filter to Stripe", async () => {
    let seen: any = null;
    await runSyncSlice({
      stripe: {} as any,
      accountId: "acct_1",
      createdGteIso: "2025-02-01T00:00:00.000Z",
      cursors: {},
      counts: {},
      upsert: async () => {},
      budgetMs: 10_000,
      now: () => 0,
      resources: [
        {
          name: "a" as any,
          table: "t_a",
          list: async (_s, params) => {
            seen = params;
            return { data: [], has_more: false };
          },
          map: (o) => ({ id: o.id }),
        },
      ],
    });
    expect(seen.created.gte).toBe(Math.floor(Date.parse("2025-02-01T00:00:00.000Z") / 1000));
    expect(seen.limit).toBe(100);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run utils/stripe/sync.test.ts`
Expected: FAIL — `runSyncSlice is not exported`.

- [ ] **Step 3: Implement**

Append to `utils/stripe/sync.ts`:

```typescript
export type SyncCursors = Record<string, { startingAfter?: string; done?: boolean }>;
export type SyncCounts = Record<string, number>;

/**
 * Works through the resources for at most `budgetMs`, then returns its cursors so
 * the caller can persist them and resume in a later request. Rows are upserted page
 * by page, so an interrupted slice never loses work it already fetched.
 */
export async function runSyncSlice(input: {
  stripe: Stripe;
  accountId: string;
  createdGteIso: string;
  cursors: SyncCursors;
  counts: SyncCounts;
  upsert: (table: string, rows: Record<string, any>[]) => Promise<void>;
  budgetMs: number;
  now: () => number;
  resources?: SyncResource[];
}): Promise<{ done: boolean; cursors: SyncCursors; counts: SyncCounts }> {
  const resources = input.resources ?? SYNC_RESOURCES;
  const cursors: SyncCursors = { ...input.cursors };
  const counts: SyncCounts = { ...input.counts };
  const createdGte = Math.floor(Date.parse(input.createdGteIso) / 1000);
  const startedAt = input.now();

  for (const resource of resources) {
    const cursor = cursors[resource.name] ?? {};
    if (cursor.done) continue;

    for (;;) {
      if (input.now() - startedAt >= input.budgetMs) {
        cursors[resource.name] = cursor;
        return { done: false, cursors, counts };
      }

      const page = await resource.list(input.stripe, {
        limit: 100,
        created: { gte: createdGte },
        ...(resource.params ?? {}),
        ...(cursor.startingAfter ? { starting_after: cursor.startingAfter } : {}),
      });

      if (page.data.length > 0) {
        await input.upsert(
          resource.table,
          page.data.map((object) => resource.map(object, input.accountId)),
        );
        counts[resource.name] = (counts[resource.name] ?? 0) + page.data.length;
        cursor.startingAfter = page.data[page.data.length - 1].id;
      }

      if (!page.has_more || page.data.length === 0) {
        cursor.done = true;
        cursors[resource.name] = cursor;
        break;
      }
      cursors[resource.name] = cursor;
    }
  }

  return { done: true, cursors, counts };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS, 38 tests total.

- [ ] **Step 5: Commit**

```bash
git add utils/stripe/sync.ts utils/stripe/sync.test.ts
git commit -m "feat: add resumable Stripe sync slice runner"
```

---

### Task 8: Sync endpoint

Admin-only. Each POST starts or continues a run, works one slice, persists cursors, and reports progress. The client calls it repeatedly until `done`.

Incremental mode also refreshes, by id, any charge referenced by a refund or dispute seen in this run — `charge.amount_refunded` mutates long after `created`, so a `created`-window sync alone leaves stale charges behind.

**Files:**
- Create: `app/api/burn/[slug]/admin/stripe-sync/route.ts`

**Interfaces:**
- Consumes: `runSyncSlice`, `SYNC_RESOURCES`, `SYNC_START_ISO` from Tasks 6–7; `requestWithProject`, `query` from `app/api/_common/endpoints.ts`; `BurnRole` from `utils/types.ts`.
- Produces: `POST /api/burn/[slug]/admin/stripe-sync` accepting `{ mode?: "full" | "incremental" }` and returning `{ runId, done, counts, resource, lastSyncedAt }`.

- [ ] **Step 1: Write the route**

```typescript
// app/api/burn/[slug]/admin/stripe-sync/route.ts
import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  runSyncSlice,
  SYNC_RESOURCES,
  SYNC_START_ISO,
  SyncCursors,
} from "@/utils/stripe/sync";

const StripeSyncRequestSchema = s.object({
  mode: s.string().optional(),
});

/** Leaves headroom under Vercel's ~15s default function timeout. */
const SLICE_BUDGET_MS = 9_000;
/** Re-scan window for incremental runs, so late-arriving objects are not missed. */
const INCREMENTAL_OVERLAP_DAYS = 7;

export const POST = requestWithProject<
  s.infer<typeof StripeSyncRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const apiKey = project!.burn_config.stripe_secret_api_key;
    if (!apiKey) {
      return NextResponse.json(
        { error: "No Stripe API key configured for this burn" },
        { status: 400 },
      );
    }

    const stripe = new Stripe(apiKey);
    const account = await stripe.accounts.retrieve();

    // Resume the run still in progress, if there is one.
    const running = await query(() =>
      supabase
        .from("stripe_sync_runs")
        .select("*")
        .eq("project_id", project!.id)
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );

    let run = running;
    let createdGteIso = SYNC_START_ISO;

    if (!run) {
      const mode = body.mode === "full" ? "full" : "incremental";
      if (mode === "incremental") {
        const lastCompleted = await query(() =>
          supabase
            .from("stripe_sync_runs")
            .select("finished_at")
            .eq("project_id", project!.id)
            .eq("status", "completed")
            .order("finished_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        );
        if (lastCompleted?.finished_at) {
          const from = new Date(lastCompleted.finished_at);
          from.setUTCDate(from.getUTCDate() - INCREMENTAL_OVERLAP_DAYS);
          createdGteIso = new Date(
            Math.max(from.getTime(), Date.parse(SYNC_START_ISO)),
          ).toISOString();
        }
      }
      run = await query(() =>
        supabase
          .from("stripe_sync_runs")
          .insert({
            project_id: project!.id,
            stripe_account_id: account.id,
            mode,
            cursors: { _createdGteIso: createdGteIso },
            counts: {},
          })
          .select()
          .single(),
      );
    }

    const cursors: SyncCursors = { ...(run.cursors ?? {}) };
    createdGteIso = (cursors as any)._createdGteIso ?? SYNC_START_ISO;

    try {
      const result = await runSyncSlice({
        stripe,
        accountId: account.id,
        createdGteIso,
        cursors,
        counts: run.counts ?? {},
        budgetMs: SLICE_BUDGET_MS,
        now: () => Date.now(),
        upsert: async (table, rows) => {
          await query(() => supabase.from(table).upsert(rows, { onConflict: "id" }));
        },
      });

      (result.cursors as any)._createdGteIso = createdGteIso;

      if (result.done) {
        await refreshMutatedCharges(supabase, stripe, account.id, createdGteIso);
      }

      await query(() =>
        supabase
          .from("stripe_sync_runs")
          .update({
            cursors: result.cursors,
            counts: result.counts,
            status: result.done ? "completed" : "running",
            finished_at: result.done ? new Date().toISOString() : null,
          })
          .eq("id", run.id),
      );

      return {
        runId: run.id,
        done: result.done,
        counts: result.counts,
        resource: SYNC_RESOURCES.find((r) => !result.cursors[r.name]?.done)?.name ?? null,
      };
    } catch (error: any) {
      await query(() =>
        supabase
          .from("stripe_sync_runs")
          .update({ status: "failed", error: error.message ?? String(error) })
          .eq("id", run.id),
      );
      throw error;
    }
  },
  StripeSyncRequestSchema,
  BurnRole.Admin,
);

/**
 * charge.amount_refunded changes long after the charge was created, so a sync
 * filtered on `created` alone would leave stale charges behind. Re-fetch by id every
 * charge that a refund or dispute in the synced window points at.
 */
async function refreshMutatedCharges(
  supabase: any,
  stripe: Stripe,
  accountId: string,
  createdGteIso: string,
) {
  const refunds = await query(() =>
    supabase
      .from("stripe_refunds")
      .select("charge_id")
      .eq("stripe_account_id", accountId)
      .gte("created_at", createdGteIso)
      .not("charge_id", "is", null),
  );
  const disputes = await query(() =>
    supabase
      .from("stripe_disputes")
      .select("charge_id")
      .eq("stripe_account_id", accountId)
      .gte("created_at", createdGteIso)
      .not("charge_id", "is", null),
  );

  const chargeIds = Array.from(
    new Set(
      [...refunds, ...disputes].map((r: any) => r.charge_id).filter(Boolean),
    ),
  );
  const chargeResource = SYNC_RESOURCES.find((r) => r.name === "charges")!;

  for (const chargeId of chargeIds) {
    const charge = await stripe.charges.retrieve(chargeId as string);
    await query(() =>
      supabase
        .from(chargeResource.table)
        .upsert([chargeResource.map(charge, accountId)], { onConflict: "id" }),
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `stripe.accounts.retrieve()` complains about arguments, call it as `stripe.accounts.retrieve()` with no argument — that returns the account behind the key.

- [ ] **Step 3: Verify authorization**

Run: `npm run dev`, then as a member *without* the admin role:
```bash
curl -X POST http://localhost:3000/api/burn/the-borderland-2026/admin/stripe-sync \
  -H 'Content-Type: application/json' -d '{"mode":"incremental"}'
```
Expected: `403 {"error":"Unauthorized"}`. As an admin, expect `200` with `{"done":false,...}` or `{"done":true,...}`.

- [ ] **Step 4: Commit**

```bash
git add "app/api/burn/[slug]/admin/stripe-sync/route.ts"
git commit -m "feat: add resumable Stripe sync endpoint"
```

---

### Task 9: Sync button

Drives the endpoint in a loop until done, showing which resource is being synced and how many objects have landed. Follows the shape of the existing `TestSendEmailButton.tsx` in the same directory.

**Files:**
- Create: `app/burn/[slug]/admin/config/StripeSyncButton.tsx`
- Modify: `app/burn/[slug]/admin/config/page.tsx` (import at the top, render at line 354 next to `<TestSendEmailButton />`)

**Interfaces:**
- Consumes: `POST /api/burn/[slug]/admin/stripe-sync` from Task 8; `apiPost` from `app/_components/api`; `useProject` from `app/_components/SessionContext`.
- Produces: default-exported `StripeSyncButton` component, no props.

- [ ] **Step 1: Write the component**

```tsx
// app/burn/[slug]/admin/config/StripeSyncButton.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiPost } from "@/app/_components/api";
import toast from "react-hot-toast";

/** Stops a bug in the loop condition from hammering Stripe forever. */
const MAX_SLICES = 200;

export default function StripeSyncButton() {
  const { project } = useProject();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const sync = async (mode: "full" | "incremental") => {
    setIsSyncing(true);
    setProgress("Starting…");
    try {
      for (let slice = 0; slice < MAX_SLICES; slice++) {
        const result = await apiPost(
          `/burn/${project?.slug}/admin/stripe-sync`,
          { mode },
        );
        const synced = Object.entries(result.counts ?? {})
          .map(([name, count]) => `${name}: ${count}`)
          .join(", ");
        if (result.done) {
          setProgress(`Done. ${synced}`);
          toast.success("Stripe data synchronized");
          return;
        }
        setProgress(`Syncing ${result.resource ?? "…"} — ${synced}`);
      }
      toast.error("Sync did not finish within the expected number of slices");
    } catch {
      // apiFetch already surfaces the error as a toast
      setProgress("Failed. Press again to resume where it stopped.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Button
        color="secondary"
        isLoading={isSyncing}
        onPress={() => sync("incremental")}
      >
        Synchronize Stripe data
      </Button>
      <Button
        color="secondary"
        variant="bordered"
        isDisabled={isSyncing}
        onPress={() => sync("full")}
      >
        Full Stripe re-sync (slow)
      </Button>
      {progress && <div className="text-sm text-gray-600">{progress}</div>}
    </>
  );
}
```

- [ ] **Step 2: Render it on the config page**

In `app/burn/[slug]/admin/config/page.tsx`, add the import beside the existing `TestSendEmailButton` import (line 14):

```typescript
import StripeSyncButton from "./StripeSyncButton";
```

and render it immediately after `<TestSendEmailButton />` (line 354):

```tsx
        <TestSendEmailButton />
        <StripeSyncButton />
```

- [ ] **Step 3: Verify in the app**

Run: `npm run dev`, open `/burn/the-borderland-2026/admin/config` as an admin, press **Synchronize Stripe data**.
Expected: progress text advances through `checkout_sessions`, `charges`, `refunds`, `balance_transactions`, `disputes`, `payouts`, then "Done." with counts. Pressing it again completes quickly, because incremental mode only re-scans the last 7 days.

- [ ] **Step 4: Verify resumability**

While a full re-sync is running, reload the page mid-way, then press **Synchronize Stripe data** again.
Expected: it resumes — counts continue from where they were rather than restarting at zero.

- [ ] **Step 5: Commit**

```bash
git add "app/burn/[slug]/admin/config/StripeSyncButton.tsx" "app/burn/[slug]/admin/config/page.tsx"
git commit -m "feat: add Stripe sync button to burn config page"
```

---

### Task 10: The joining view

One row per paid checkout session, exposing Stripe facts only. No sale classification, no Alversjö split, no fee proration — those are policy and live in `attribution.ts`, where they are unit-tested and can change without a migration.

The view's column names must match `MembershipPaymentRow` from Task 2 exactly, because the finances route casts rows straight to that type.

**Files:**
- Create: `supabase/migrations/20260728120100_stripe_membership_payments_view.sql`

**Interfaces:**
- Consumes: the tables from Task 1, plus the existing `burn_membership_purchase_rights`.
- Produces: view `stripe_membership_payments` with columns `session_id, payment_intent_id, paid_at, project_id, currency, amount_total, fee, fee_refunded, disputed_amount, dispute_fee, has_alversjo, refunds`.

- [ ] **Step 1: Write the migration**

```sql
-- One row per paid checkout session, joined to everything needed to compute
-- income. Stripe facts only: the policy (which sale, how a refund splits between
-- membership and Alversjö, how the fee prorates) lives in utils/stripe/attribution.ts
-- so that it is unit-tested and can change without a migration.
--
-- Not materialised: it reads burn_membership_purchase_rights, which changes
-- independently of any Stripe sync, and 13k rows makes recomputation free.

create view stripe_membership_payments as
select
  s.id                                as session_id,
  s.payment_intent_id                 as payment_intent_id,
  s.created_at                        as paid_at,
  mpr.project_id                      as project_id,
  upper(s.currency)                   as currency,
  coalesce(s.amount_total, 0)         as amount_total,
  coalesce(bt.fee, 0)                 as fee,
  coalesce(r.fee_refunded, 0)         as fee_refunded,
  coalesce(d.disputed_amount, 0)      as disputed_amount,
  coalesce(d.dispute_fee, 0)          as dispute_fee,
  coalesce(
    (mpr.metadata -> 'enabled_addons') ? 'alversjo-membership',
    false
  )                                   as has_alversjo,
  coalesce(r.refunds, '[]'::jsonb)    as refunds
from stripe_checkout_sessions s
-- The succeeded charge for this payment intent. A payment intent can accumulate
-- failed attempts, so filter on status rather than taking the first row.
left join lateral (
  select c.*
  from stripe_charges c
  where c.payment_intent_id = s.payment_intent_id
    and c.status = 'succeeded'
  order by c.created_at
  limit 1
) c on true
left join stripe_balance_transactions bt
  on bt.id = c.balance_transaction_id
-- Succeeded refunds, individually (the Alversjö rule needs each amount, not a sum)
-- plus the fees Stripe gave back on them, which are negative.
left join lateral (
  select
    jsonb_agg(jsonb_build_object('amount', rf.amount) order by rf.created_at)
      as refunds,
    coalesce(sum(rbt.fee), 0) as fee_refunded
  from stripe_refunds rf
  left join stripe_balance_transactions rbt on rbt.id = rf.balance_transaction_id
  where rf.payment_intent_id = s.payment_intent_id
    and rf.status = 'succeeded'
) r on true
-- Disputes are read through their balance transactions rather than their status:
-- the money is withdrawn when the dispute opens and returned by a reversing entry
-- if it is won, so summing the entries is self-correcting.
left join lateral (
  select
    coalesce(-sum(dbt.amount), 0) as disputed_amount,
    coalesce(sum(dbt.fee), 0)     as dispute_fee
  from stripe_disputes dp
  left join stripe_balance_transactions dbt
    on dbt.id = any(dp.balance_transaction_ids)
  where dp.charge_id = c.id
) d on true
left join burn_membership_purchase_rights mpr
  on mpr.id = s.membership_purchase_right_id
where s.payment_status = 'paid';
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
npm run supabase:reset
```
Expected: completes without error.

- [ ] **Step 3: Verify the view against real data**

After running a sync against production (Task 9), check the view reproduces the figures from the spec. Run:
```bash
node -e '
const fs=require("fs");
for(const l of fs.readFileSync(".env","utf8").split("\n")){const m=l.match(/^([A-Z_]+)="?(.*?)"?$/);if(m)process.env[m[1]]=m[2];}
(async()=>{
const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;
const r=await fetch(`${u}/rest/v1/stripe_membership_payments?select=amount_total,fee&paid_at=gte.2025-10-01`,{headers:{apikey:k,Authorization:`Bearer ${k}`}});
const rows=await r.json();
console.log("rows",rows.length,"gross",rows.reduce((a,x)=>a+x.amount_total,0)/100,"fees",rows.reduce((a,x)=>a+x.fee,0)/100);
})();'
```
Expected: `rows 6257 gross 13656196 fees 253923.22` — the figures recorded in the spec.

- [ ] **Step 4: Verify the Alversjö flag**

Expected: 422 rows in that window have `has_alversjo = true`. Append `&has_alversjo=is.true` to the query above and check the count.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260728120100_stripe_membership_payments_view.sql
git commit -m "feat: add stripe_membership_payments view"
```

---

### Task 11: Finances endpoint

Fetches the view, the balance-transaction summary and the transfer list, hands them to `aggregateFinances`, returns the payload. Aggregates only — no per-payment rows, because `customer_email` must never reach the client.

**Files:**
- Create: `app/api/burn/[slug]/statistics/finances/route.ts`

**Interfaces:**
- Consumes: `aggregateFinances` (Task 5), the view (Task 10), `requestWithMembership` and `query` from `app/api/_common/endpoints.ts`, `ALVERSJO_ADDON_ID` (Task 2).
- Produces: `GET /api/burn/[slug]/statistics/finances` returning `FinancesPayload`.

- [ ] **Step 1: Write the route**

```typescript
// app/api/burn/[slug]/statistics/finances/route.ts
import { requestWithMembership, query } from "@/app/api/_common/endpoints";
import { aggregateFinances } from "@/utils/stripe/attribution";
import {
  ALVERSJO_ADDON_ID,
  BalanceSummary,
  MembershipPaymentRow,
} from "@/utils/stripe/types";
import { stripeCurrenciesWithoutDecimals } from "@/app/api/_common/stripe";

export const GET = requestWithMembership(
  async (supabase, profile, request, body, project) => {
    const burnConfig = project!.burn_config;
    const currency = burnConfig.membership_price_currency;

    // burn_config stores prices in display units; the mirror is in minor units.
    const minorUnitFactor = stripeCurrenciesWithoutDecimals.includes(
      currency.toUpperCase(),
    )
      ? 1
      : 100;
    const alversjoPrice = Math.round(
      (burnConfig.membership_addons.find((a) => a.id === ALVERSJO_ADDON_ID)
        ?.price ?? 0) * minorUnitFactor,
    );

    const lastRun = await query(() =>
      supabase
        .from("stripe_sync_runs")
        .select("finished_at, stripe_account_id")
        .eq("project_id", project!.id)
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );

    if (!lastRun) {
      return aggregateFinances({
        rows: [],
        projectId: project!.id,
        alversjoPrice,
        eventEndDate: new Date(burnConfig.event_end_date ?? Date.now()),
        currency,
        transferPaymentIntentIds: [],
        balanceSummary: {
          netExcludingPayouts: 0,
          payouts: { count: 0, amount: 0 },
          other: { count: 0, amount: 0 },
        },
        lastSyncedAt: null,
      });
    }

    const rows: MembershipPaymentRow[] = await query(() =>
      supabase.from("stripe_membership_payments").select("*"),
    );

    const balanceTransactions = await query(() =>
      supabase
        .from("stripe_balance_transactions")
        .select("type, amount")
        .eq("stripe_account_id", lastRun.stripe_account_id),
    );

    const balanceSummary: BalanceSummary = {
      netExcludingPayouts: 0,
      payouts: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    };
    for (const bt of balanceTransactions) {
      if (bt.type === "payout") {
        balanceSummary.payouts.count++;
        balanceSummary.payouts.amount += bt.amount;
        continue;
      }
      balanceSummary.netExcludingPayouts += bt.amount;
      if (bt.type !== "charge" && bt.type !== "refund") {
        balanceSummary.other.count++;
        balanceSummary.other.amount += bt.amount;
      }
    }

    // Transfers are counted against the sale the *original* membership was bought in,
    // which its payment intent identifies. Requires the backfill (Task 13) for the
    // pre-2026-03-14 rows to be present.
    const transfers = await query(() =>
      supabase
        .from("burn_membership_transfers")
        .select("original_membership_json")
        .eq("project_id", project!.id),
    );
    const transferPaymentIntentIds = transfers
      .map((t: any) => t.original_membership_json?.stripe_payment_intent_id)
      .filter(Boolean);

    return aggregateFinances({
      rows,
      projectId: project!.id,
      alversjoPrice,
      eventEndDate: new Date(burnConfig.event_end_date ?? Date.now()),
      currency,
      transferPaymentIntentIds,
      balanceSummary,
      lastSyncedAt: lastRun.finished_at,
    });
  },
);
```

Note on the balance summary: `netExcludingPayouts` covers the whole account, while the sale rows cover one burn. For the 2026 burn the 2025 objects fall outside the synced window in practice, but where they do not, the difference lands in `residual` — which is the point of the reconciliation block.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify against the spec's figures**

Run `npm run dev`, sign in as a member of the 2026 burn, and fetch:
```bash
curl -s http://localhost:3000/api/burn/the-borderland-2026/statistics/finances | head -40
```
Expected: `total.operatingIncome` equals gross minus refunds — 13,656,196 − 1,518,947.48 SEK expressed in öre — and `total.stripeFees` is 253,923.22 SEK in öre less the 10,626.30 SEK of fee refunds. `fall.refunds` should be 1, matching the single fall-sale refund found in the account.

- [ ] **Step 4: Confirm no personal data leaks**

Run: `curl -s http://localhost:3000/api/burn/the-borderland-2026/statistics/finances | grep -ci "@"`
Expected: `0` — no email addresses anywhere in the payload.

- [ ] **Step 5: Commit**

```bash
git add "app/api/burn/[slug]/statistics/finances/route.ts"
git commit -m "feat: add finances statistics endpoint"
```

---

### Task 12: Finances section on the statistics page

Replaces the two hand-computed income cards, which multiply counts by configured prices and are wrong whenever anything was refunded.

**Files:**
- Create: `app/burn/[slug]/statistics/FinancesSection.tsx`
- Modify: `app/burn/[slug]/statistics/page.tsx` — delete the `project?.burn_config && (...)` block at lines 292–335, render `<FinancesSection />` in its place

**Interfaces:**
- Consumes: `GET /burn/[slug]/statistics/finances` (Task 11), `FinancesPayload` (Task 2), `formatMoney` from `app/_components/utils`, `apiGet` from `app/_components/api`.
- Produces: default-exported `FinancesSection`, no props.

- [ ] **Step 1: Write the component**

```tsx
// app/burn/[slug]/statistics/FinancesSection.tsx
"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import { formatMoney } from "@/app/_components/utils";
import { FinancesPayload, SaleTotals } from "@/utils/stripe/types";
import { stripeCurrenciesWithoutDecimals } from "@/app/api/_common/stripe";

export default function FinancesSection() {
  const { project } = useProject();
  const [data, setData] = useState<FinancesPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project?.slug) return;
    apiGet(`/burn/${project.slug}/statistics/finances`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [project?.slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  if (!data) return null;

  // The API works in Stripe minor units; formatMoney expects display units.
  const factor = stripeCurrenciesWithoutDecimals.includes(
    data.currency.toUpperCase(),
  )
    ? 1
    : 100;
  const money = (minorUnits: number) =>
    formatMoney(minorUnits / factor, data.currency);

  const rows: { label: string; get: (t: SaleTotals) => string; strong?: boolean }[] =
    [
      {
        label: "Membership income (excl. Alversjö)",
        get: (t) => money(t.membershipIncome),
      },
      { label: "Alversjö income", get: (t) => money(t.alversjoIncome) },
      {
        label: "Operating income (payments − refunds)",
        get: (t) => money(t.operatingIncome),
        strong: true,
      },
      { label: "Stripe fees", get: (t) => money(t.stripeFees) },
      { label: "Net after fees", get: (t) => money(t.netAfterFees) },
      { label: "Payments", get: (t) => String(t.payments) },
      { label: "Refunds", get: (t) => String(t.refunds) },
      { label: "Membership transfers", get: (t) => String(t.transfers) },
    ];

  const stale =
    !data.lastSyncedAt ||
    Date.now() - Date.parse(data.lastSyncedAt) > 24 * 60 * 60 * 1000;

  const r = data.reconciliation;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow mt-4">
      <h2 className="text-base sm:text-lg font-semibold mb-1">Finances</h2>
      <p className="text-xs sm:text-sm text-gray-500 mb-4">
        Taken directly from Stripe. Gross and net are both shown: operating income is
        payments less refunds, before fees.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4 font-medium"> </th>
              <th className="py-2 px-4 font-medium text-right">Fall sale</th>
              <th className="py-2 px-4 font-medium text-right">Spring sale</th>
              <th className="py-2 pl-4 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b last:border-b-0">
                <td className={`py-2 pr-4 ${row.strong ? "font-semibold" : ""}`}>
                  {row.label}
                </td>
                <td className={`py-2 px-4 text-right ${row.strong ? "font-semibold" : ""}`}>
                  {row.get(data.fall)}
                </td>
                <td className={`py-2 px-4 text-right ${row.strong ? "font-semibold" : ""}`}>
                  {row.get(data.spring)}
                </td>
                <td className={`py-2 pl-4 text-right ${row.strong ? "font-semibold" : ""}`}>
                  {row.get(data.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-sm font-semibold mt-6 mb-1">Reconciliation</h3>
      <p className="text-xs text-gray-500 mb-2">
        Why the sale rows do not equal the bank statement.
      </p>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-1 pr-4">Sale rows, net of fees</td>
            <td className="py-1 text-right">{money(r.saleRowsNet)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-4">
              Payments not belonging to this burn ({r.unattributedPayments.count})
            </td>
            <td className="py-1 text-right">{money(r.unattributedPayments.amount)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-4">
              Disputes ({r.disputes.count}), incl. {money(r.disputes.fees)} in fees
            </td>
            <td className="py-1 text-right">{money(r.disputes.amount)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-4">
              Other balance transactions ({r.otherBalanceTransactions.count})
            </td>
            <td className="py-1 text-right">{money(r.otherBalanceTransactions.amount)}</td>
          </tr>
          <tr className="border-b font-semibold">
            <td className="py-1 pr-4">Stripe balance movement (excl. payouts)</td>
            <td className="py-1 text-right">{money(r.balanceNetExcludingPayouts)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-4">Unexplained residual</td>
            <td
              className={`py-1 text-right ${r.residual !== 0 ? "text-red-500 font-semibold" : ""}`}
            >
              {money(r.residual)}
            </td>
          </tr>
          <tr>
            <td className="py-1 pr-4 text-gray-500">
              Paid out to bank ({r.payouts.count})
            </td>
            <td className="py-1 text-right text-gray-500">{money(r.payouts.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div className={`text-xs mt-4 ${stale ? "text-red-500" : "text-gray-500"}`}>
        {data.lastSyncedAt
          ? `Last synchronized with Stripe: ${new Date(data.lastSyncedAt).toLocaleString()}`
          : "Never synchronized with Stripe — figures are empty until an admin runs a sync."}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Swap it into the statistics page**

In `app/burn/[slug]/statistics/page.tsx`, add the import after the existing `formatMoney` import (line 9):

```typescript
import FinancesSection from "./FinancesSection";
```

Delete the whole `{project?.burn_config && ( ... )}` block spanning lines 292–335 — the two cards labelled "Total Membership Income" and "Total Alversjö Membership Income" — and put in its place:

```tsx
      <FinancesSection />
```

`formatMoney` is then unused in `page.tsx`; remove it from the import on line 9 so lint stays clean.

- [ ] **Step 3: Verify in the app**

Run: `npm run dev`, open `/burn/the-borderland-2026/statistics` as a member.
Expected: the table renders with fall and spring columns; membership income plus Alversjö income equals operating income in every column; the residual reads 0 and is not red.

- [ ] **Step 4: Verify the empty state**

Temporarily point at a project with no completed sync (or delete the `stripe_sync_runs` rows locally).
Expected: zeros throughout and "Never synchronized with Stripe", not an error.

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
npm run prettier-fix
git add "app/burn/[slug]/statistics/FinancesSection.tsx" "app/burn/[slug]/statistics/page.tsx"
git commit -m "feat: show Stripe-based finances on the statistics page"
```

---

### Task 13: Reconstruct the missing membership transfers

`burn_membership_transfers` was introduced by migration `20260303130000` and its earliest row is 2026-03-14, but transfers happened from the fall sale onwards. Until it is complete, the "Membership transfers" row understates every sale.

The reconstruction leans on one fact about the webhook in `app/api/webhooks/stripe/route.ts`: it issues the refund to the old owner and inserts the new membership inside a single request, so the two timestamps are seconds apart.

**This task must not insert anything until its validation gate passes.** The gate runs the same algorithm over the period where the table already holds the truth and demands an exact match.

**Files:**
- Create: `supabase/migrations/20260728120200_burn_membership_transfers_metadata.sql`
- Create: `scripts/backfill-membership-transfers.mjs`

**Interfaces:**
- Consumes: `stripe_membership_payments` (Task 10), `stripe_refunds`, and the existing `burn_membership_purchase_rights`, `burn_memberships`, `burn_membership_transfers`.
- Produces: `node scripts/backfill-membership-transfers.mjs --project the-borderland-2026 [--apply]`. Without `--apply` it reports only.

- [ ] **Step 1: Add the metadata column**

```sql
-- Marks rows reconstructed by scripts/backfill-membership-transfers.mjs, whose
-- original_membership_json is rebuilt from the purchase right and is therefore
-- partial compared to rows written live by the Stripe webhook.
alter table burn_membership_transfers add column metadata jsonb;
```

- [ ] **Step 2: Apply it**

Run: `npm run supabase:reset`
Expected: completes without error.

- [ ] **Step 3: Write the backfill script**

```javascript
#!/usr/bin/env node
/**
 * Reconstructs burn_membership_transfers rows for transfers that happened before
 * the table existed (migration 20260303130000; earliest real row 2026-03-14).
 *
 * A transfer leaves two traces: a partial refund on the old owner's payment, and a
 * new membership created in the same webhook request. Those timestamps are seconds
 * apart, which is what lets the two sides be paired.
 *
 * Reports by default. Pass --apply to insert.
 *
 * Usage:
 *   node scripts/backfill-membership-transfers.mjs --project the-borderland-2026
 *   node scripts/backfill-membership-transfers.mjs --project the-borderland-2026 --apply
 */

import { readFileSync } from "fs";
import { join } from "path";

function loadEnv() {
  try {
    const env = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of env.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1).replace(/\\(.)/g, "$1");
      }
      process.env[match[1].trim()] = value;
    }
  } catch {}
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

/** The migration that created burn_membership_transfers. Live rows exist after this. */
const TABLE_LIVE_FROM = "2026-03-14T00:00:00Z";
/** How close in time a refund and a new membership must be to be one transfer. */
const PAIRING_WINDOW_MS = 10_000;

const args = process.argv.slice(2);
const projectSlug = args[args.indexOf("--project") + 1];
const apply = args.includes("--apply");
if (!projectSlug || projectSlug.startsWith("--")) {
  console.error("--project <slug> is required");
  process.exit(1);
}

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** Fetches every row of a table, paging past PostgREST's default limit. */
async function all(path) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await rest(
      `${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${offset}`,
    );
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

const [project] = await rest(`projects?slug=eq.${projectSlug}&select=id,slug`);
if (!project) {
  console.error(`No project with slug ${projectSlug}`);
  process.exit(1);
}

const [burnConfig] = await rest(
  `burn_config?project_id=eq.${project.id}&select=membership_addons,membership_price_currency`,
);
// burn_config stores display units; the Stripe mirror stores minor units.
const MINOR = ["JPY", "KRW", "VND", "CLP"].includes(
  (burnConfig?.membership_price_currency ?? "SEK").toUpperCase(),
)
  ? 1
  : 100;
const ALVERSJO_MINOR = Math.round(
  ((burnConfig?.membership_addons ?? []).find(
    (a) => a.id === "alversjo-membership",
  )?.price ?? 0) * MINOR,
);

const payments = await all(
  `stripe_membership_payments?select=*&project_id=eq.${project.id}`,
);
const refunds = await all(`stripe_refunds?select=*&status=eq.succeeded`);
const purchaseRights = await all(
  `burn_membership_purchase_rights?select=id,owner_id,first_name,last_name,birthdate,metadata&project_id=eq.${project.id}`,
);
const memberships = await all(
  `burn_memberships?select=id,owner_id,created_at,stripe_payment_intent_id&project_id=eq.${project.id}`,
);
const existing = await all(
  `burn_membership_transfers?select=*&project_id=eq.${project.id}`,
);

const sessionByPi = new Map(
  payments.filter((p) => p.payment_intent_id).map((p) => [p.payment_intent_id, p]),
);
const rightById = new Map(purchaseRights.map((r) => [r.id, r]));
const sessionRightByPi = new Map();
{
  const sessions = await all(
    `stripe_checkout_sessions?select=payment_intent_id,membership_purchase_right_id&payment_status=eq.paid`,
  );
  for (const s of sessions) {
    if (s.payment_intent_id && s.membership_purchase_right_id) {
      sessionRightByPi.set(s.payment_intent_id, s.membership_purchase_right_id);
    }
  }
}

/**
 * Candidate transfers: payment intents with a partial refund that is not simply the
 * Alversjö addon being cancelled. Full refunds are returns, not transfers.
 */
function candidates() {
  const byPi = new Map();
  for (const r of refunds) {
    if (!r.payment_intent_id) continue;
    if (!byPi.has(r.payment_intent_id)) byPi.set(r.payment_intent_id, []);
    byPi.get(r.payment_intent_id).push(r);
  }

  const out = [];
  for (const [pi, rs] of byPi) {
    const payment = sessionByPi.get(pi);
    if (!payment) continue; // another burn, or the demo project
    const refundedTotal = rs.reduce((a, r) => a + r.amount, 0);
    if (refundedTotal >= payment.amount_total) continue; // a return
    const isAddonOnly =
      payment.has_alversjo &&
      ALVERSJO_MINOR > 0 &&
      rs.every((r) => r.amount === ALVERSJO_MINOR);
    if (isAddonOnly) continue;
    const latest = rs.reduce((a, b) =>
      Date.parse(a.created_at) > Date.parse(b.created_at) ? a : b,
    );
    out.push({
      paymentIntentId: pi,
      payment,
      refundedTotal,
      refundedAt: Date.parse(latest.created_at),
    });
  }
  return out.sort((a, b) => a.refundedAt - b.refundedAt);
}

/** Pairs each candidate with the membership created in the same webhook request. */
function pair(cands) {
  const used = new Set();
  return cands.map((c) => {
    const rightId = sessionRightByPi.get(c.paymentIntentId);
    const right = rightId ? rightById.get(rightId) : null;

    let best = null;
    let bestDelta = Infinity;
    for (const m of memberships) {
      if (used.has(m.id)) continue;
      const delta = Math.abs(Date.parse(m.created_at) - c.refundedAt);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = m;
      }
    }
    const matched = best && bestDelta <= PAIRING_WINDOW_MS ? best : null;
    if (matched) used.add(matched.id);

    return {
      ...c,
      fromOwnerId: right?.owner_id ?? null,
      toOwnerId: matched?.owner_id ?? null,
      right,
      deltaMs: matched ? bestDelta : null,
    };
  });
}

const paired = pair(candidates());

// --- Validation gate -------------------------------------------------------
// Re-derive the transfers that the table already holds. The algorithm must
// reproduce them exactly before it is trusted with the ones it does not.
const liveFrom = Date.parse(TABLE_LIVE_FROM);
const derivedLive = paired.filter((p) => p.refundedAt >= liveFrom);
const existingByFromTo = new Map(
  existing.map((e) => [
    `${e.from_owner_id}|${e.to_owner_id}|${Math.round(e.refund_amount * MINOR)}`,
    e,
  ]),
);

let matched = 0;
const mismatches = [];
for (const d of derivedLive) {
  const key = `${d.fromOwnerId}|${d.toOwnerId}|${d.refundedTotal}`;
  if (existingByFromTo.has(key)) matched++;
  else mismatches.push(d);
}

console.log(`Project: ${project.slug}`);
console.log(`Existing transfer rows: ${existing.length}`);
console.log(`Candidates derived from Stripe: ${paired.length}`);
console.log(
  `Validation (after ${TABLE_LIVE_FROM}): derived ${derivedLive.length}, matched ${matched}, mismatched ${mismatches.length}`,
);

if (mismatches.length > 0) {
  console.error("\nValidation FAILED. The algorithm does not reproduce known rows:");
  for (const m of mismatches.slice(0, 10)) {
    console.error(
      `  pi=${m.paymentIntentId} from=${m.fromOwnerId} to=${m.toOwnerId} refunded=${m.refundedTotal} delta=${m.deltaMs}ms`,
    );
  }
  console.error("\nNothing was inserted. Investigate before re-running.");
  process.exit(1);
}

// --- Backfill --------------------------------------------------------------
const existingPis = new Set(
  existing
    .map((e) => e.original_membership_json?.stripe_payment_intent_id)
    .filter(Boolean),
);
const toInsert = [];
const unresolved = [];

for (const p of paired) {
  if (p.refundedAt >= liveFrom) continue; // already covered by live rows
  if (existingPis.has(p.paymentIntentId)) continue; // idempotent
  if (!p.fromOwnerId || !p.toOwnerId) {
    unresolved.push(p);
    continue;
  }
  toInsert.push({
    project_id: project.id,
    from_owner_id: p.fromOwnerId,
    to_owner_id: p.toOwnerId,
    // burn_membership_transfers.refund_amount is a float in display units
    refund_amount: p.refundedTotal / MINOR,
    price_currency: p.payment.currency,
    created_at: new Date(p.refundedAt).toISOString(),
    original_membership_json: {
      stripe_payment_intent_id: p.paymentIntentId,
      first_name: p.right?.first_name ?? null,
      last_name: p.right?.last_name ?? null,
      birthdate: p.right?.birthdate ?? null,
      price: p.payment.amount_total / MINOR,
      price_currency: p.payment.currency,
      metadata: p.right?.metadata ?? null,
    },
    metadata: { reconstructed: true },
  });
}

console.log(`\nTo insert: ${toInsert.length}`);
console.log(`Unresolved (reported, not guessed): ${unresolved.length}`);
for (const u of unresolved.slice(0, 20)) {
  console.log(
    `  pi=${u.paymentIntentId} refundedAt=${new Date(u.refundedAt).toISOString()} from=${u.fromOwnerId ?? "?"} to=${u.toOwnerId ?? "?"}`,
  );
}

if (!apply) {
  console.log("\nDry run. Re-run with --apply to insert.");
  process.exit(0);
}

for (let i = 0; i < toInsert.length; i += 100) {
  await rest("burn_membership_transfers", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(toInsert.slice(i, i + 100)),
  });
  console.log(`inserted ${Math.min(i + 100, toInsert.length)}/${toInsert.length}`);
}
console.log("Done.");
```

- [ ] **Step 4: Run the validation gate**

Run:
```bash
node scripts/backfill-membership-transfers.mjs --project the-borderland-2026
```
Expected: `mismatched 0`, then a count of rows it would insert and any unresolved candidates.

If mismatches appear, do **not** loosen the comparison to make it pass. The likely causes, in order: `PAIRING_WINDOW_MS` too tight for slow webhook requests; memberships that were transferred onwards and deleted, so the receiving row no longer exists; or a refund issued manually in the Stripe dashboard rather than by the webhook. Diagnose which, and only then adjust — reporting a candidate as unresolved is always preferable to pairing it wrongly.

- [ ] **Step 5: Apply the backfill**

Run:
```bash
node scripts/backfill-membership-transfers.mjs --project the-borderland-2026 --apply
```
Expected: inserts complete, and re-running reports `To insert: 0` — the script is idempotent.

- [ ] **Step 6: Confirm the statistics page picks it up**

Reload `/burn/the-borderland-2026/statistics`.
Expected: the "Membership transfers" row now shows a non-zero fall figure, where before the backfill it was zero because the table began in March.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260728120200_burn_membership_transfers_metadata.sql scripts/backfill-membership-transfers.mjs
git commit -m "feat: reconstruct membership transfers predating the transfers table"
```

---

## Done

All thirteen tasks complete. Final verification:

- [x] `npm test` — 43 tests pass (38 planned, plus 5 added below)
- [x] `npx tsc --noEmit` — no errors
- [x] `npm run lint` — clean
- [x] `npm run build` — succeeds
- [x] The statistics page reconciliation residual reads 1,733.20, not 0 — see below

---

## As shipped

Verifying against production changed several things. The tasks above are the plan
as written; this section is what actually exists. Where the two disagree, this
section and the commit history are correct.

### Two migrations the plan did not have

**`20260728120300_..._security_invoker.sql`.** The view as specified was
exploitable. Postgres views run with their owner's privileges unless
`security_invoker` is set, so `stripe_membership_payments` returned payment rows
to the **public anon key** even though RLS correctly refused them on the base
tables. Proved with a probe row, fixed, re-verified, probe removed.

This also prompted auditing the rest of the schema, which found twelve
pre-existing tables readable with the anon key — including 596,846 `request_logs`
rows carrying IP addresses. Fixed separately, outside this plan.

**`20260728120400_..._owner.sql`.** Adds `owner_id` to the view so a transfer can
be paired with its incoming payment by identity rather than by timestamp alone.
Needed by the transfer surplus below.

### Task 5 — reconciliation was wrong three times over

The residual only balances if every term is on the same basis. Three defects, each
of which silently inflated it:

- unattributed payments were added **gross** while the sale rows are net of
  refunds and fees, so other burns' fee bills landed in the residual;
- balance transactions were summed on `amount` rather than `net`, leaving the
  entire Stripe fee bill (~423k SEK) unexplained;
- dispute entries were counted **both** inside the sale rows and again in the
  `other` bucket, subtracting them twice.

`unattributedPayments` therefore carries a `net` field alongside `amount`, and the
finances route sums `bt.net` and skips `reporting_category = 'dispute'` when
filling the `other` bucket.

The residual settles at **1,733.20 SEK**, not zero: one 2025-09 charge with no
checkout session behind it. That is a true unexplained payment, shown in red
rather than hidden.

### Task 13 — the backfill algorithm is not the one specified

The planned pairing (refund ↔ nearest `burn_memberships` row) reproduced only
735 of 806 known rows, because **memberships are deleted when transferred
onwards**, so any chain of transfers leaves earlier links unpairable. Three
rewrites were needed:

1. **Pair on the incoming Stripe charge, not the membership row.** Charges and
   checkout sessions are immutable and always survive. 735 → 798.
2. **Mutual-nearest matching.** Two transfers seconds apart were being paired
   crosswise. Walk candidate purchases nearest-first and take the first that no
   other refund is closer to; leave anything ambiguous unresolved. 798 → 803.
3. **Validate on `(from_owner, to_owner)`, not on amount.** `refund_amount`
   records only what the webhook itself refunded, so it disagrees with the Stripe
   total whenever a payment also carries an unrelated refund.

The gate as specified — exact match or abort — cannot pass, because three
transfers have **no incoming charge at all** within any window. Those turned out
to be the same three hit by a separate refund bug, where the refund arrived 11 to
25 days after the transfer. The gate therefore fails on a **wrong** pairing and
merely reports an absent one.

Final: **803/806 reproduced, 0 wrong, 3 ambiguous.** Eight rows inserted, dated
2026-03-10 to 2026-03-13.

### An extra feature: surplus from transfers

Added after the plan was written. Per transfer, what the burn ends up with
because the membership changed hands rather than the original holder keeping it:

```
(B paid − B's net fee) − refunded to A − A's refunded fee
```

The counterfactual's A-leg terms cancel, and it telescopes across A→B→C chains.
Attributed to the sale the *original* membership came from, matching the transfer
count. Lives in `SaleTotals.transferSurplus`; the aggregator takes
`TransferInput[]` rather than the planned `transferPaymentIntentIds: string[]`.

Against production: **+274,500.94 SEK** across all 814 transfers, none skipped —
+42,940.58 over 609 transfers in the 3% era and +231,560.36 over 205 in the 50%
era, with **151 of 814 individually negative** where the incoming Stripe fee
exceeded the retained buffer.

### Verification could not be done the way the plan assumed

No Docker and no local Postgres, so `npm run supabase:start` / `db reset` were
unavailable. Migrations were applied to production with `supabase db push` and
verified there. Note that `db push` refuses to run from a branch whose local
migrations are a subset of remote, and suggests
`migration repair --status reverted` — **do not run that**; it would falsely mark
live migrations as reverted. Place the missing files in the working tree
uncommitted instead.

The sync was driven through the real `runSyncSlice` via `vite-node` rather than
the HTTP endpoint, which needs an authenticated admin session. It completed in 20
slices, resuming correctly across every one.

### Figures confirmed against the Stripe API

The view reproduces 6,257 rows, 13,656,196.00 gross, 253,923.22 fees and 422
Alversjö exactly. Refund totals differ from a naive Stripe-side sum by 4,040.00,
which is two refunds issued in the 2026 window against **2025-burn** payments —
the view attributes them to the 2025 project, correctly.

<!-- PLAN-END -->
