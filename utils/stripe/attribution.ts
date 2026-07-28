import {
  BalanceSummary,
  FinancesPayload,
  MembershipPaymentRow,
  PaymentSplit,
  SaleKey,
  SaleTotals,
} from "@/utils/stripe/types";

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

  const alversjoDisputed = alversjoShare(
    row.disputed_amount,
    alversjoGross,
    total,
  );
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

/**
 * Rolls per-payment splits up into the fall/spring/total table and computes the
 * reconciliation block. Payments belonging to another burn (the 2025 project, the
 * demo project) or with no resolvable purchase right are excluded from the sale
 * rows and reported as unattributed.
 */
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
  let unattributedNet = 0;
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
      // Net on the same basis as the sale rows, so the residual compares like
      // with like. The Alversjö split is irrelevant here — it redistributes
      // within a payment without changing its net.
      const refunded = row.refunds.reduce((a, r) => a + r.amount, 0);
      unattributedNet +=
        row.amount_total -
        refunded -
        row.disputed_amount -
        (row.fee + row.fee_refunded + row.dispute_fee);
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
  // kept, less the fees paid on it. Dispute amounts and fees are already inside the
  // sale rows (splitPayment deducts them), so they are reported for visibility but
  // not subtracted again here.
  const saleRowsNet = total.netAfterFees;
  const accountedFor =
    saleRowsNet + unattributedNet + input.balanceSummary.other.amount;

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
        net: unattributedNet,
      },
      disputes: {
        count: disputeCount,
        amount: disputeAmount,
        fees: disputeFees,
      },
      otherBalanceTransactions: input.balanceSummary.other,
      balanceNetExcludingPayouts: input.balanceSummary.netExcludingPayouts,
      residual: input.balanceSummary.netExcludingPayouts - accountedFor,
      payouts: input.balanceSummary.payouts,
    },
    lastSyncedAt: input.lastSyncedAt,
  };
}
