import {
  MembershipPaymentRow,
  PaymentSplit,
  SaleKey,
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
