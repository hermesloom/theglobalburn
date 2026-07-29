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

## Alversjö invoice block

Alversjö invoices BL for the land memberships sold through BL. Christian has been
assembling that invoice by hand from a Stripe spreadsheet each time. The page
should produce its lines directly.

One block, below the finances table, reproducing the line structure of the 2025
invoice so it can be typed straight into Fortnox:

```
Landmedlemskap / Land memberships       234,00 pcs ×  480,00 =  112 320,00
Refunds on Alversjö memberships         −53,71 pcs ×  480,00 =  −25 781,42
Banking (Stripe) fees (fall + spring)    −1,00      3 782,54 =  − 3 782,54

                                              Excl. VAT          82 756,04
                                                 VAT 25%         20 689,01
                                                   Total        103 445,05
```

### What the block covers, and why

It is the invoice for what is **still outstanding**, not for the whole burn. The
fall memberships were already invoiced and paid at 112,800.00, so they are
excluded by simply not counting them — no "already paid" deduction line. But
fall's Stripe fee was never deducted at the time, so it is carried here.

- **Memberships**: spring sale only, priced at the addon price excl VAT.
- **Refunds**: the Alversjö share of refunds, expressed as negative units so it
  reads as a quantity rather than an unexplained deduction. All refunds fall in
  the spring sale; fall had none.
- **Stripe fees**: fall plus spring, prorated per payment by each payment's
  Alversjö share of that payment's total.

Cross-check: 108,173.22 spring net − 1,951.87 fall fee − 2,776.31 spring fee =
103,445.04, matching the block total to the öre.

### VAT

The fee line is written as `fee ÷ 1.25` so that the full fee comes off the
VAT-inclusive total, exactly as the 2025 invoice was constructed (`5,640.07 ÷
1.25 = 4,512.06`, giving 310,500.00 − 5,640.07 = 304,860.00). VAT is 25%, a named
constant — Swedish VAT on this supply does not vary, and a config field for it
would be speculative.

### Derived, not entered

The unit price is the addon price from `burn_config` divided by 1.25, not the
literal 480. Quantities, refunds and fees all come from figures the aggregator
already computes per payment; the block adds no new data source.

This requires exposing three values per sale that are currently computed and
discarded: Alversjö gross, Alversjö refunded, and the Alversjö fee share. Today
only the net survives into the payload.

### Known divergence from the 2025 hand calculation

Applying this method to BL 2025 gives 520.76 units and 5,871.61 in fees, against
Christian's 517.50 and 5,640.07. Not an error on either side: he counted the 508
surviving memberships plus 9.5 units for nineteen 50%-refund cases found by hand,
whereas this attributes a proportional share of **every** refund, so the ~3%
retained on 97%-refund transfers also lands with Alversjö. This method is ~1,954
kr more favourable to Alversjö and does not depend on spotting special cases
manually. Worth flagging to Christian, since it means BL 2026 is computed on a
slightly different basis than BL 2025.

## Testing

Existing tests covering the reconciliation block are removed rather than adapted;
the behaviour they described no longer exists. New tests cover:

- a chargeback appearing as its own deduction and **not** reducing operating
  income, so the same payment is not counted against the burn twice;
- `netKept` = operating income − fees − chargebacks;
- carer memberships counting in the total but in neither sale column;
- payments belonging to another burn being skipped silently, with no effect on
  any figure;
- the Alversjö invoice block: quantities and refund units derived from the
  addon price rather than a literal 480, the fee line carrying both sales, and
  the block total equalling spring net less both sales' fees.

Verified against production before shipping: operating income must equal today's
figure plus 2,222.00, and the membership total must read 5,443.
