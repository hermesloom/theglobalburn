# Finances section: BL 2026 only, money in and money out

**Date:** 2026-07-29
**Status:** Approved design, ready for planning

## Problem

The finances section reports on the whole Stripe account and then explains, in a
reconciliation block, why most of what it reports is irrelevant. Three of its five
lines exist only to subtract things that were never BL 2026 in the first place:

- **Payments not belonging to this burn** — 6,037 payments, all from the 2025 burn,
  which shares the Stripe account.
- **Other balance transactions** — a pair of ±500 SEK internal transfers, netting
  to exactly zero.
- **Unexplained residual** — 1,733.20 SEK, which turned out to be a single Open
  Collective donation (`ch_3SAQEpEuBjGnolU20J3GqwJc`, 2025-09-23, "Financial
  contribution to The Borderland", from `eric.reinford@gmail.com`, 2,000.00 gross
  less a 200.00 Open Collective application fee and 66.80 Stripe fee).

None of that is BL 2026 income. Two further lines are unclear rather than wrong:
**Sale rows, net of fees** silently restates the table's own Net-after-fees total,
and **Disputes** shows a figure with no indication whether it is money gained or
lost, or how it relates to the rows above.

## Decision

The page reports on **BL 2026 and nothing else**, and reads as what added to the
burn's money and what took from it.

### Removed

The entire reconciliation block, including all five lines above. Payments
belonging to another burn are skipped rather than counted and subtracted.

**What this gives up:** the page can no longer cross-check its figures against
total movement in the Stripe account. Previously a mistake in attribution would
surface as a non-zero residual. After this change it would not — the numbers
become internally consistent by construction. That is an accepted trade: the
cross-check was only meaningful while the page pretended to describe the whole
account.

### The table

Fall / spring / total, in money-in-then-money-out order:

| Row | |
|---|---|
| Membership income (excl. Alversjö) | + |
| Alversjö income | + |
| **Operating income** (payments − refunds) | **=** |
| Stripe fees | − |
| Chargebacks | − |
| **Net kept** | **=** |
| Memberships | count |
| Checked in | count |
| Payments · Refunds · Membership transfers | counts |
| Surplus from transfers | |

### Chargebacks become visible

A chargeback is money lost: the cardholder's bank reverses the payment and Stripe
also charges a fee. BL 2026 has one — 2,222.00 SEK reversed plus a 200.00 SEK fee,
withdrawn 2026-05-28, still `under_review`.

Today that is deducted silently inside operating income, which is why the current
"Disputes" line reads as unrelated to everything around it. After this change:

- `splitPayment` stops subtracting `disputed_amount` from the net, and stops
  folding `dispute_fee` into the fee.
- `SaleTotals` gains `chargebacks` = disputed amount + dispute fee, shown as its
  own deduction.
- `netAfterFees` is replaced by `netKept` = operating income − Stripe fees −
  chargebacks.

Operating income therefore rises by 2,222.00 against today's figure, and the
chargeback appears explicitly as −2,422.00. Nothing is counted twice.

### Carer memberships

Five memberships have no Stripe payment: they are free memberships for carers of
persons with disabilities. Four of the five checked in.

They cannot be dated to a sale, so they stay out of the fall and spring columns,
but they are counted in the **Total** column so the membership count matches
reality (5,443, not 5,438). A labelled line beneath reads *"of which carer
memberships (free): 5"*.

## Implementation

- `utils/stripe/types.ts` — `SaleTotals`: add `chargebacks`, replace
  `netAfterFees` with `netKept`. `FinancesPayload`: drop `reconciliation`, add
  `carerMemberships: number`. Drop `BalanceSummary` entirely.
- `utils/stripe/attribution.ts` — `splitPayment` no longer deducts disputes;
  `aggregateFinances` drops the `balanceSummary` input and the unattributed
  accounting, adds carer counting into the total.
- `app/api/burn/[slug]/statistics/finances/route.ts` — stops querying
  `stripe_balance_transactions` altogether. One fewer query, ~14.5k fewer rows
  per request.
- `app/burn/[slug]/statistics/FinancesSection.tsx` — new row order, chargeback
  row, carer line, reconciliation block deleted.

## Testing

Existing tests covering the reconciliation block are removed rather than adapted;
the behaviour they described no longer exists. New tests cover:

- a chargeback appearing as its own deduction and **not** reducing operating
  income, so the same payment is not counted against the burn twice;
- `netKept` = operating income − fees − chargebacks;
- carer memberships counting in the total but in neither sale column;
- payments belonging to another burn being skipped silently, with no effect on
  any figure.

Verified against production before shipping: operating income must equal today's
figure plus 2,222.00, and the membership total must read 5,443.
