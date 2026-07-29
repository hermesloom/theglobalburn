import {
  AlversjoInvoice,
  ALVERSJO_VAT_RATE,
  FinancesPayload,
  MembershipCountInput,
  MembershipPaymentRow,
  PaymentSplit,
  SaleKey,
  SaleTotals,
  TransferInput,
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
  // Alversjö can never give back more than it received. A payment whose addon
  // was refunded on its own and which was later transferred would otherwise be
  // charged for the addon twice and go negative.
  alversjoRefunded = Math.min(alversjoRefunded, alversjoGross);
  const baseRefunded = refundedTotal - alversjoRefunded;

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
}

function emptyTotals(): SaleTotals {
  return {
    membershipIncome: 0,
    alversjoIncome: 0,
    operatingIncome: 0,
    stripeFees: 0,
    chargebacks: 0,
    netKept: 0,
    payments: 0,
    refunds: 0,
    transfers: 0,
    transferSurplus: 0,
    memberships: 0,
    checkedIn: 0,
    alversjoGross: 0,
    alversjoRefunded: 0,
    alversjoFee: 0,
  };
}

function addInto(target: SaleTotals, source: SaleTotals) {
  target.membershipIncome += source.membershipIncome;
  target.alversjoIncome += source.alversjoIncome;
  target.operatingIncome += source.operatingIncome;
  target.stripeFees += source.stripeFees;
  target.chargebacks += source.chargebacks;
  target.netKept += source.netKept;
  target.payments += source.payments;
  target.refunds += source.refunds;
  target.transfers += source.transfers;
  target.transferSurplus += source.transferSurplus;
  target.memberships += source.memberships;
  target.checkedIn += source.checkedIn;
  target.alversjoGross += source.alversjoGross;
  target.alversjoRefunded += source.alversjoRefunded;
  target.alversjoFee += source.alversjoFee;
}

/** Total refunded on a payment. */
function refundedTotal(row: MembershipPaymentRow) {
  return row.refunds.reduce((a, r) => a + r.amount, 0);
}

/** fee + fee refunds + dispute fee. */
function netFeeOf(row: MembershipPaymentRow) {
  return row.fee + row.fee_refunded + row.dispute_fee;
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
  transfers: TransferInput[];
  memberships: MembershipCountInput[];
  lastSyncedAt: string | null;
}): FinancesPayload {
  const sales: Record<SaleKey, SaleTotals> = {
    fall: emptyTotals(),
    spring: emptyTotals(),
  };
  const byPaymentIntent = new Map<string, MembershipPaymentRow>();
  const byOwner = new Map<string, MembershipPaymentRow[]>();
  for (const row of input.rows) {
    if (row.payment_intent_id) byPaymentIntent.set(row.payment_intent_id, row);
    if (row.owner_id) {
      const list = byOwner.get(row.owner_id) ?? [];
      list.push(row);
      byOwner.set(row.owner_id, list);
    }
  }
  const transfers = new Set(
    input.transfers.map((t) => t.fromPaymentIntentId).filter(Boolean) as string[],
  );

  let carerMemberships = 0;
  let carerCheckedIn = 0;

  for (const row of input.rows) {
    if (row.project_id !== input.projectId) continue;

    const sale = classifySale(new Date(row.paid_at), input.eventEndDate);
    const split = splitPayment(row, input.alversjoPrice);
    const totals = sales[sale];

    totals.membershipIncome += split.baseNet;
    totals.alversjoIncome += split.alversjoNet;
    totals.operatingIncome += split.baseNet + split.alversjoNet;
    totals.stripeFees += split.netFee;
    totals.alversjoGross += split.alversjoGross;
    totals.alversjoRefunded += split.alversjoRefunded;
    totals.alversjoFee += split.alversjoFee;
    totals.chargebacks += split.chargeback;
    totals.netKept +=
      split.baseNet + split.alversjoNet - split.netFee - split.chargeback;
    totals.payments++;
    if (row.refunds.length > 0) totals.refunds++;
    if (row.payment_intent_id && transfers.has(row.payment_intent_id)) {
      totals.transfers++;
    }
  }

  // Transfer surplus: what the burn ends up with because the transfer happened,
  // against the counterfactual of the original holder simply keeping the
  // membership. The A-leg gross and fee cancel between the two scenarios, leaving
  // the incoming payment net of its fee, less everything given back to A.
  // Attributed to the sale the *original* membership was bought in, matching the
  // transfer count above.
  for (const transfer of input.transfers) {
    if (!transfer.fromPaymentIntentId || !transfer.toOwnerId) continue;
    const from = byPaymentIntent.get(transfer.fromPaymentIntentId);
    if (!from || from.project_id !== input.projectId) continue;

    // The incoming payment is identified by who received the membership, then by
    // which of their payments sits closest to the transfer. Identity first means a
    // busy minute of unrelated sales cannot mispair it.
    const at = Date.parse(transfer.at);
    let to: MembershipPaymentRow | null = null;
    let bestDelta = Infinity;
    for (const candidate of byOwner.get(transfer.toOwnerId) ?? []) {
      if (candidate.payment_intent_id === transfer.fromPaymentIntentId) continue;
      const delta = Math.abs(Date.parse(candidate.paid_at) - at);
      if (delta < bestDelta) {
        bestDelta = delta;
        to = candidate;
      }
    }
    if (!to) continue;

    const surplus =
      to.amount_total - netFeeOf(to) - refundedTotal(from) - from.fee_refunded;
    sales[classifySale(new Date(from.paid_at), input.eventEndDate)]
      .transferSurplus += surplus;
  }

  // Memberships currently held, counted against the sale they were bought in.
  // A membership acquired by transfer is dated by the payment that acquired it,
  // not by the original holder's purchase, which is what makes the counts add up
  // against the payments above.
  for (const membership of input.memberships) {
    const payment = membership.paymentIntentId
      ? byPaymentIntent.get(membership.paymentIntentId)
      : undefined;
    if (!payment) {
      carerMemberships++;
      if (membership.checkedIn) carerCheckedIn++;
      continue;
    }
    const totals =
      sales[classifySale(new Date(payment.paid_at), input.eventEndDate)];
    totals.memberships++;
    if (membership.checkedIn) totals.checkedIn++;
  }

  const total = emptyTotals();
  addInto(total, sales.fall);
  addInto(total, sales.spring);

  // Carer memberships are free and have no payment, so they cannot be dated to a
  // sale. They are real people who were on site, so they count in the total -
  // including their check-ins, or the checked-in percentage would be wrong.
  total.memberships += carerMemberships;
  total.checkedIn += carerCheckedIn;

  const vatDivisor = 1 + ALVERSJO_VAT_RATE;
  const exclVat = (n: number) => Math.round(n / vatDivisor);
  const unitPriceExclVat = exclVat(input.alversjoPrice);
  // Spring memberships only: fall was already invoiced gross at its full value.
  const quantity = input.alversjoPrice
    ? sales.spring.alversjoGross / input.alversjoPrice
    : 0;
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
    refundedUnits: unitPriceExclVat ? refundExclVat / unitPriceExclVat : 0,
    refundExclVat,
    feesInclVat,
    feesExclVat,
    subtotalExclVat,
    vat,
    totalInclVat: subtotalExclVat + vat,
  };

  return {
    currency: input.currency,
    fall: sales.fall,
    spring: sales.spring,
    total,
    carerMemberships,
    alversjoInvoice,
    lastSyncedAt: input.lastSyncedAt,
  };
}
