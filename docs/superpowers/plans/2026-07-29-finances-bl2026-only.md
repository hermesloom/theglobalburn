# BL-2026-only Finances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the finances section describe BL 2026 and nothing else, show what added to and took from the burn's money, and produce the Alversjö invoice lines directly.

**Architecture:** All changes sit in the existing pure aggregation layer (`utils/stripe/attribution.ts`) and its two consumers — the finances route and the React section. No schema change, no new query; the route in fact loses one. Every figure already exists per payment; the work is stopping some of it being discarded and stopping one of it being wrong.

**Tech Stack:** TypeScript, vitest 3, Next.js 15 App Router, NextUI 2.

**Spec:** `docs/superpowers/specs/2026-07-29-finances-bl2026-only-design.md` — read it first, particularly the two refund rules, which are the only subtle parts.

## Global Constraints

- **Amounts are Stripe minor units** (öre) throughout the aggregation layer. Convert only in React, via `formatMoney(amount, currency)`.
- **Alversjö addon price comes from `burn_config.membership_addons`**, id `alversjo-membership`. Never hardcode 600 or 480.
- **VAT is 25%**, a named constant `ALVERSJO_VAT_RATE = 0.25` in `utils/stripe/types.ts`. Not configurable.
- **Alversjö's share of refunds is capped at `alversjoGross`.** It can never give back more than it received; the excess falls to the base membership.
- **Retained transfer fees count towards Alversjö**, unconditionally, on every refund. No special-casing on whether the transfer recipient also bought the addon.
- **The Alversjö invoice covers spring memberships but both sales' Stripe fees**, because fall was invoiced gross at 112,800.00 and its fee was never deducted.
- Existing tests that describe the reconciliation block are **deleted, not adapted** — the behaviour they cover ceases to exist.

## File Structure

| File | Change |
|---|---|
| `utils/stripe/types.ts` | `SaleTotals`: add `chargebacks`, `alversjoGross`, `alversjoRefunded`, `alversjoFee`; rename `netAfterFees` → `netKept`. `FinancesPayload`: drop `reconciliation`, add `carerMemberships` and `alversjoInvoice`. Delete `BalanceSummary`. Add `ALVERSJO_VAT_RATE`. |
| `utils/stripe/attribution.ts` | `splitPayment`: cap Alversjö refunds, stop deducting disputes. `aggregateFinances`: drop `balanceSummary` and unattributed accounting, add carer counting, build the invoice. |
| `utils/stripe/attribution.test.ts` | Delete reconciliation tests; add tests for the cap, chargebacks, carers, invoice. |
| `app/api/burn/[slug]/statistics/finances/route.ts` | Stop querying `stripe_balance_transactions`. |
| `app/burn/[slug]/statistics/FinancesSection.tsx` | New row order, chargeback row, carer line, invoice block; reconciliation block deleted. |

Five tasks, each independently testable. Tasks 1–3 are pure functions with tests; 4 and 5 are the consumers.

---

### Task 1: Cap Alversjö's share of refunds

The bug: a payment of 2,822 (2,222 membership + 600 addon) whose addon was
cancelled and refunded separately, and which was later transferred, has the 600
attributed wholly to Alversjö **and** a proportional slice of the transfer refund
taken from Alversjö too. Its net goes negative. Six BL 2026 payments are affected
and Alversjö is under-credited by 2,274.78 kr.

**Files:**
- Modify: `utils/stripe/attribution.ts` (`splitPayment`)
- Modify: `utils/stripe/attribution.test.ts`

**Interfaces:**
- Consumes: `MembershipPaymentRow`, `PaymentSplit` (unchanged shapes).
- Produces: `splitPayment` with `alversjoRefunded <= alversjoGross` always.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe("splitPayment", ...)` block:

```typescript
  it("never takes back more from Alversjö than it received", () => {
    // Real shape: 2822 paid, the 600 addon cancelled and refunded on its own,
    // then the membership transferred with a further partial refund. Alversjö
    // must not be charged for the addon twice.
    const s = splitPayment(
      row({
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
        refunds: [{ amount: 60_000 }, { amount: 141_100 }],
      }),
      ALVERSJO,
    );
    expect(s.alversjoRefunded).toBe(60_000);
    expect(s.alversjoNet).toBe(0);
    // the remainder belongs to the base membership
    expect(s.baseRefunded).toBe(141_100);
    expect(s.baseNet).toBe(222_200 - 141_100);
    expect(s.baseRefunded + s.alversjoRefunded).toBe(201_100);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run utils/stripe/attribution.test.ts -t "never takes back more"`
Expected: FAIL — `alversjoRefunded` is 90,000 (60,000 + a 30,000 share of the
second refund), so `alversjoNet` is −30,000.

- [ ] **Step 3: Apply the cap**

In `utils/stripe/attribution.ts`, replace the refund loop and the line computing
`baseRefunded`:

```typescript
  let alversjoRefunded = 0;
  let refundedTotal = 0;
  for (const refund of row.refunds) {
    refundedTotal += refund.amount;
    alversjoRefunded +=
      alversjoGross > 0 && refund.amount === alversjoGross
        ? refund.amount
        : alversjoShare(refund.amount, alversjoGross, total);
  }
  // Alversjö can never give back more than it received. A payment whose addon
  // was refunded on its own and which was later transferred would otherwise be
  // charged for the addon twice and go negative.
  alversjoRefunded = Math.min(alversjoRefunded, alversjoGross);
  const baseRefunded = refundedTotal - alversjoRefunded;
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS. The existing "50% + addon refund shape" test still passes — its
refunds sum to 201,100 in one refund rather than two, so the cap does not bind.

- [ ] **Step 5: Commit**

```bash
git add utils/stripe/attribution.ts utils/stripe/attribution.test.ts
git commit -m "fix: stop charging Alversjö twice for a separately refunded addon"
```

---

### Task 2: Chargebacks become their own deduction

A chargeback is money lost. Today it is silently subtracted inside operating
income, which is why the current "Disputes" line reads as unrelated to the rows
around it.

**Files:**
- Modify: `utils/stripe/types.ts` (`SaleTotals`, `PaymentSplit`)
- Modify: `utils/stripe/attribution.ts` (`splitPayment`, `emptyTotals`, `addInto`, `aggregateFinances`)
- Modify: `utils/stripe/attribution.test.ts`

**Interfaces:**
- Produces: `PaymentSplit` gains `chargeback: number` (disputed amount + dispute
  fee). `SaleTotals` gains `chargebacks: number` and renames `netAfterFees` to
  `netKept`. `splitPayment` no longer subtracts disputes from `baseNet` /
  `alversjoNet`, and `netFee` no longer includes `dispute_fee`.

- [ ] **Step 1: Write the failing tests**

Replace the existing `"deducts disputed amounts from net income"` test with:

```typescript
  it("reports a chargeback separately instead of hiding it in income", () => {
    // Real case: the one disputed 2222 SEK charge, plus its 200 SEK dispute fee.
    const s = splitPayment(
      row({ disputed_amount: 222_200, dispute_fee: 20_000 }),
      ALVERSJO,
    );
    expect(s.baseNet).toBe(222_200); // income untouched
    expect(s.netFee).toBe(3_513); // dispute fee not folded into the fee
    expect(s.chargeback).toBe(242_200); // amount plus fee
  });
```

and update the fee test in the same block:

```typescript
  it("nets fee refunds into the fee", () => {
    const s = splitPayment(row({ fee: 3_513, fee_refunded: -1_200 }), ALVERSJO);
    expect(s.netFee).toBe(3_513 - 1_200);
  });
```

Then, inside `describe("aggregateFinances", ...)`, add:

```typescript
  it("subtracts chargebacks after income rather than inside it", () => {
    const p = aggregate([
      row({
        paid_at: "2026-03-01T09:00:00Z",
        amount_total: 222_200,
        fee: 3_513,
        disputed_amount: 222_200,
        dispute_fee: 20_000,
      }),
    ]);
    expect(p.spring.operatingIncome).toBe(222_200);
    expect(p.spring.stripeFees).toBe(3_513);
    expect(p.spring.chargebacks).toBe(242_200);
    expect(p.spring.netKept).toBe(222_200 - 3_513 - 242_200);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run utils/stripe/attribution.test.ts`
Expected: FAIL — `chargeback` and `chargebacks` do not exist, `netKept` does not
exist.

- [ ] **Step 3: Update the types**

In `utils/stripe/types.ts`, add to `PaymentSplit`:

```typescript
  /** Money the cardholder's bank took back, plus Stripe's dispute fee. */
  chargeback: number;
```

and in `SaleTotals` replace `netAfterFees: number;` with:

```typescript
  /** Money taken back by cardholders, including Stripe's dispute fees. */
  chargebacks: number;
  /** operatingIncome − stripeFees − chargebacks. */
  netKept: number;
```

- [ ] **Step 4: Update splitPayment**

In `utils/stripe/attribution.ts`, replace the dispute handling and the return:

```typescript
  const netFee = row.fee + row.fee_refunded;
  const alversjoFee = alversjoShare(netFee, alversjoGross, total);
  const baseFee = netFee - alversjoFee;

  return {
    baseGross,
    alversjoGross,
    baseRefunded,
    alversjoRefunded,
    // Disputes are not deducted here. They are money taken back after the fact,
    // reported on their own line so income does not quietly absorb them.
    baseNet: baseGross - baseRefunded,
    alversjoNet: alversjoGross - alversjoRefunded,
    baseFee,
    alversjoFee,
    netFee,
    chargeback: row.disputed_amount + row.dispute_fee,
  };
```

Delete the now-unused `alversjoDisputed` and `baseDisputed` lines.

- [ ] **Step 5: Update the aggregator**

In `emptyTotals()` replace `netAfterFees: 0,` with `chargebacks: 0,` and
`netKept: 0,`. In `addInto()` replace the `netAfterFees` line with:

```typescript
  target.chargebacks += source.chargebacks;
  target.netKept += source.netKept;
```

In the per-row loop of `aggregateFinances`, replace the `totals.netAfterFees`
line with:

```typescript
    totals.chargebacks += split.chargeback;
    totals.netKept +=
      split.baseNet + split.alversjoNet - split.netFee - split.chargeback;
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add utils/stripe/types.ts utils/stripe/attribution.ts utils/stripe/attribution.test.ts
git commit -m "feat: show chargebacks as money out instead of hiding them in income"
```

---

### Task 3: Drop the reconciliation, add carers and the Alversjö invoice

**Files:**
- Modify: `utils/stripe/types.ts` (`SaleTotals`, `FinancesPayload`, delete `BalanceSummary`, add `ALVERSJO_VAT_RATE`, `AlversjoInvoice`)
- Modify: `utils/stripe/attribution.ts` (`aggregateFinances`)
- Modify: `utils/stripe/attribution.test.ts`

**Interfaces:**
- Consumes: `PaymentSplit.chargeback`, `SaleTotals.netKept` from Task 2.
- Produces: `aggregateFinances` without the `balanceSummary` input; payload with
  `carerMemberships: number` and `alversjoInvoice: AlversjoInvoice`, and no
  `reconciliation`.

- [ ] **Step 1: Write the failing tests**

Delete these four tests from `describe("aggregateFinances", ...)`, whose
behaviour no longer exists: `"excludes payments belonging to another project and
counts them as unattributed"`, `"reconciles other burns' payments net, not
gross"`, `"reconciles to zero when every movement is accounted for"`, and
`"surfaces a non-zero residual rather than hiding it"`.

Replace the first of them with:

```typescript
  it("ignores payments belonging to another burn entirely", () => {
    const p = aggregate([
      row({ paid_at: "2026-03-01T09:00:00Z", amount_total: 222_200 }),
      row({ paid_at: "2026-03-02T09:00:00Z", amount_total: 1_000, project_id: null }),
      row({ paid_at: "2026-03-03T09:00:00Z", amount_total: 3_000, project_id: "other" }),
    ]);
    expect(p.total.operatingIncome).toBe(222_200);
    expect(p.total.payments).toBe(1);
  });
```

Update the carer test to assert the new field, and add the invoice tests:

```typescript
  it("counts carer memberships in the total but in neither sale", () => {
    const p = aggregate([row({ payment_intent_id: "pi_known" })], {
      memberships: [
        { paymentIntentId: "pi_known", checkedIn: false },
        { paymentIntentId: null, checkedIn: true },
        { paymentIntentId: "pi_not_in_mirror", checkedIn: false },
      ],
    });
    expect(p.fall.memberships).toBe(0);
    expect(p.spring.memberships).toBe(1);
    expect(p.total.memberships).toBe(3); // 1 payment-backed + 2 carers
    expect(p.total.checkedIn).toBe(1); // the carer who checked in
    expect(p.carerMemberships).toBe(2);
  });

  it("builds the Alversjö invoice from spring memberships and both sales' fees", () => {
    const p = aggregate([
      // fall: one addon, no refund
      row({
        paid_at: "2025-11-20T09:00:00Z",
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
      }),
      // spring: two addons, one of them refunded in full
      row({
        paid_at: "2026-03-01T09:00:00Z",
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
      }),
      row({
        paid_at: "2026-03-02T09:00:00Z",
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
        refunds: [{ amount: 60_000 }],
      }),
    ]);
    const inv = p.alversjoInvoice;
    expect(inv.unitPriceExclVat).toBe(48_000); // 60000 / 1.25
    expect(inv.quantity).toBe(2); // spring only
    expect(inv.refundedUnits).toBeCloseTo(1, 4);
    // fees: 938 per payment (4413 * 60000/282200), three payments
    expect(inv.feesInclVat).toBe(938 * 3);
    expect(inv.totalInclVat).toBe(60_000 * 1 - 938 * 3);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run utils/stripe/attribution.test.ts`
Expected: FAIL — `carerMemberships` and `alversjoInvoice` do not exist.

- [ ] **Step 3: Update the types**

In `utils/stripe/types.ts`, delete the `BalanceSummary` type, add to `SaleTotals`:

```typescript
  /** Alversjö addon sold, before refunds. */
  alversjoGross: number;
  /** Alversjö's share of refunds, capped at what it received. */
  alversjoRefunded: number;
  /** Alversjö's share of Stripe fees, prorated by amount. */
  alversjoFee: number;
```

and add:

```typescript
/** Swedish VAT on the land membership supply. Does not vary. */
export const ALVERSJO_VAT_RATE = 0.25;

/**
 * The invoice Alversjö sends BL for land memberships. Covers the spring
 * memberships only - fall was already invoiced gross - but both sales' Stripe
 * fees, because fall's were never deducted. All amounts in minor units.
 */
export type AlversjoInvoice = {
  quantity: number;
  unitPriceExclVat: number;
  linesExclVat: number;
  refundedUnits: number;
  refundExclVat: number;
  /** The real fee. Divided by 1 + VAT on the invoice so it comes off after VAT. */
  feesInclVat: number;
  feesExclVat: number;
  subtotalExclVat: number;
  vat: number;
  totalInclVat: number;
};
```

Then replace the `reconciliation` block in `FinancesPayload` with:

```typescript
  /** Free memberships with no Stripe payment, for carers. Counted in the total. */
  carerMemberships: number;
  alversjoInvoice: AlversjoInvoice;
```

- [ ] **Step 4: Update the aggregator**

In `aggregateFinances`: drop `balanceSummary` from the input type, delete
`unattributedCount` / `unattributedAmount` / `unattributedNet` /
`disputeCount` / `disputeAmount` / `disputeFees` and the block that populates
them, and replace the project-mismatch branch with a plain `continue`:

```typescript
    if (row.project_id !== input.projectId) continue;
```

Accumulate the Alversjö detail in the per-row loop, beside the existing lines:

```typescript
    totals.alversjoGross += split.alversjoGross;
    totals.alversjoRefunded += split.alversjoRefunded;
    totals.alversjoFee += split.alversjoFee;
```

Change carer counting so they land in the total. Replace the
`unclassifiedMemberships++` line with:

```typescript
      carerMemberships++;
      if (membership.checkedIn) carerCheckedIn++;
      continue;
```

declaring `let carerMemberships = 0;` and `let carerCheckedIn = 0;` beside the
other counters, and after `addInto(total, sales.spring)` add:

```typescript
  // Carer memberships are free and have no payment, so they cannot be dated to a
  // sale. They are real people who were on site, so they count in the total -
  // including their check-ins, or the checked-in percentage would be wrong.
  total.memberships += carerMemberships;
  total.checkedIn += carerCheckedIn;
```

Then build the invoice and return it:

```typescript
  const vatDivisor = 1 + ALVERSJO_VAT_RATE;
  const exclVat = (n: number) => Math.round(n / vatDivisor);
  const unitPriceExclVat = exclVat(input.alversjoPrice);
  // Spring memberships only: fall was already invoiced gross at its full value.
  const quantity = sales.spring.alversjoGross / input.alversjoPrice;
  const linesExclVat = Math.round(quantity * unitPriceExclVat);
  const refundExclVat = exclVat(sales.spring.alversjoRefunded);
  // Both sales' fees: fall's were never deducted when fall was invoiced.
  const feesInclVat = sales.fall.alversjoFee + sales.spring.alversjoFee;
  const feesExclVat = exclVat(feesInclVat);
  const subtotalExclVat = linesExclVat - refundExclVat - feesExclVat;
  const vat = Math.round(subtotalExclVat * ALVERSJO_VAT_RATE);

  const alversjoInvoice: AlversjoInvoice = {
    quantity,
    unitPriceExclVat,
    linesExclVat,
    refundedUnits: unitPriceExclVat
      ? refundExclVat / unitPriceExclVat
      : 0,
    refundExclVat,
    feesInclVat,
    feesExclVat,
    subtotalExclVat,
    vat,
    totalInclVat: subtotalExclVat + vat,
  };
```

Return `carerMemberships` and `alversjoInvoice` in place of `reconciliation`.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/stripe/types.ts utils/stripe/attribution.ts utils/stripe/attribution.test.ts
git commit -m "feat: scope finances to this burn and derive the Alversjö invoice"
```

---

### Task 4: Drop the balance-transaction query from the route

The account-wide balance summary existed only to feed the reconciliation block.
With that gone the route stops fetching ~14,500 rows it no longer uses.

**Files:**
- Modify: `app/api/burn/[slug]/statistics/finances/route.ts`

**Interfaces:**
- Consumes: `aggregateFinances` without `balanceSummary` (Task 3).

- [ ] **Step 1: Remove the balance summary**

Delete the `emptyBalance` constant, the `stripe_balance_transactions` query, the
`balanceSummary` object and the loop that fills it. Delete `BalanceSummary` from
the import.

The early return for "never synced" becomes:

```typescript
    if (!lastRun) {
      return aggregateFinances({
        rows: [],
        projectId: project!.id,
        alversjoPrice,
        eventEndDate: new Date(burnConfig.event_end_date ?? Date.now()),
        currency,
        transfers: [],
        memberships: [],
        lastSyncedAt: null,
      });
    }
```

and the final call drops its `balanceSummary` line.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `lastRun.stripe_account_id` is now unused, narrow the
select to `finished_at`.

- [ ] **Step 3: Verify against production**

Run the finances endpoint as a signed-in user and check the figures. The
statistics page requires a membership or `BurnRole.Admin`.

Expected, for `the-borderland-2026`: `spring.operatingIncome` is **2,222.00 SEK
higher** than before this change (the chargeback no longer hidden inside it),
`spring.chargebacks` is `242200`, `total.memberships` is `5443`,
`carerMemberships` is `5`, and `alversjoInvoice.totalInclVat` is `10571983`
(105,719.83 SEK).

- [ ] **Step 4: Commit**

```bash
git add "app/api/burn/[slug]/statistics/finances/route.ts"
git commit -m "perf: stop fetching balance transactions the finances page no longer uses"
```

---

### Task 5: Rebuild the finances section UI

**Files:**
- Modify: `app/burn/[slug]/statistics/FinancesSection.tsx`

**Interfaces:**
- Consumes: `FinancesPayload` with `carerMemberships` and `alversjoInvoice`,
  `SaleTotals` with `chargebacks` and `netKept` (Tasks 2–3).

- [ ] **Step 1: Reorder the table and add the chargeback row**

Replace the `rows` array with:

```tsx
  const rows: {
    label: string;
    get: (t: SaleTotals) => string;
    strong?: boolean;
  }[] = [
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
    { label: "Stripe fees", get: (t) => money(-t.stripeFees) },
    { label: "Chargebacks", get: (t) => money(-t.chargebacks) },
    { label: "Net kept", get: (t) => money(t.netKept), strong: true },
    { label: "Memberships", get: (t) => String(t.memberships) },
    {
      label: "Checked in",
      get: (t) =>
        t.memberships > 0
          ? `${t.checkedIn} (${Math.round((t.checkedIn / t.memberships) * 100)}%)`
          : String(t.checkedIn),
    },
    { label: "Payments", get: (t) => String(t.payments) },
    { label: "Refunds", get: (t) => String(t.refunds) },
    { label: "Membership transfers", get: (t) => String(t.transfers) },
    {
      label: "Surplus from transfers",
      get: (t) => money(t.transferSurplus),
    },
  ];
```

Fees and chargebacks are negated so the column reads as money out.

- [ ] **Step 2: Replace the intro text and delete the reconciliation block**

Change the paragraph under the heading to:

```tsx
      <p className="text-xs sm:text-sm text-gray-500 mb-4">
        Taken directly from Stripe, for this burn only. Operating income is
        payments less refunds, before fees. Chargebacks are payments reversed by
        the cardholder&apos;s bank, including Stripe&apos;s fee for them.
      </p>
```

Delete everything from `<h3 ...>Reconciliation</h3>` down to the closing
`</table>` of that second table, and the `const r = data.reconciliation;` line.

- [ ] **Step 3: Add the carer line under the table**

Immediately after the closing `</div>` of the table's `overflow-x-auto` wrapper:

```tsx
      {data.carerMemberships > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          Of the total, {data.carerMemberships} are free carer memberships for
          people supporting a person with a disability. They have no payment, so
          they appear only in the total.
        </p>
      )}
```

- [ ] **Step 4: Add the Alversjö invoice block**

Before the last-synced footer:

```tsx
      <h3 className="text-sm font-semibold mt-6 mb-1">Alversjö invoice</h3>
      <p className="text-xs text-gray-500 mb-2">
        What Alversjö should invoice BL for the land memberships. Covers the
        spring memberships — the fall ones were already invoiced — and the Stripe
        fees from both sales, since fall&apos;s were never deducted.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-1 pr-4">Landmedlemskap / Land memberships</td>
              <td className="py-1 px-4 text-right text-gray-500">
                {inv.quantity.toFixed(2)} × {money(inv.unitPriceExclVat)}
              </td>
              <td className="py-1 text-right">{money(inv.linesExclVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-1 pr-4">Refunds on Alversjö memberships</td>
              <td className="py-1 px-4 text-right text-gray-500">
                −{inv.refundedUnits.toFixed(2)} × {money(inv.unitPriceExclVat)}
              </td>
              <td className="py-1 text-right">{money(-inv.refundExclVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-1 pr-4">Banking (Stripe) fees</td>
              <td className="py-1 px-4 text-right text-gray-500">
                {money(inv.feesInclVat)} ÷ {1 + ALVERSJO_VAT_RATE}
              </td>
              <td className="py-1 text-right">{money(-inv.feesExclVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-1 pr-4">Excl. VAT</td>
              <td />
              <td className="py-1 text-right">{money(inv.subtotalExclVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-1 pr-4">
                VAT {ALVERSJO_VAT_RATE * 100}%
              </td>
              <td />
              <td className="py-1 text-right">{money(inv.vat)}</td>
            </tr>
            <tr className="font-semibold">
              <td className="py-1 pr-4">Total</td>
              <td />
              <td className="py-1 text-right">{money(inv.totalInclVat)}</td>
            </tr>
          </tbody>
        </table>
      </div>
```

Add `const inv = data.alversjoInvoice;` beside the other locals, and import
`ALVERSJO_VAT_RATE` from `@/utils/stripe/types`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: no errors, no new warnings.

Then open `/burn/the-borderland-2026/statistics` signed in and check: the
chargeback row shows −2,422.00 in spring, "Net kept" equals operating income less
fees less chargebacks in every column, the carer line reads 5, and the invoice
totals **105,719.83**.

- [ ] **Step 6: Commit**

```bash
git add "app/burn/[slug]/statistics/FinancesSection.tsx"
git commit -m "feat: money-in/money-out finances table and Alversjö invoice block"
```

---

## Done

- [ ] `npm test` — all pass
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — succeeds
- [ ] Live figures: invoice total 105,719.83, memberships 5,443, chargebacks −2,422.00

<!-- PLAN-END -->
