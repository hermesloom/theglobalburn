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
  /** The profile that bought this membership, via its purchase right. */
  owner_id: string | null;
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
  /**
   * What the burn gained (or lost) because these transfers happened, versus the
   * original holders simply keeping their memberships:
   *   (B paid - B's net fee) - what was refunded to A - A's refunded fee
   * The A-leg terms of the counterfactual cancel out. Goes negative when the
   * incoming payment's Stripe fee exceeds the retained transfer fee, which the
   * 3% era made routine.
   */
  transferSurplus: number;
};

/** One transfer, as the aggregator needs it to price the surplus. */
export type TransferInput = {
  /** Payment intent of the membership that was given up. */
  fromPaymentIntentId: string | null;
  /** Profile that received the membership. */
  toOwnerId: string | null;
  /** When the transfer completed, for pairing with the incoming payment. */
  at: string;
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
    /**
     * Payments in the mirror belonging to another burn or with no resolvable
     * purchase right. `amount` is gross; `net` is after their own refunds,
     * disputes and fees, and is what the residual arithmetic uses.
     */
    unattributedPayments: { count: number; amount: number; net: number };
    disputes: { count: number; amount: number; fees: number };
    otherBalanceTransactions: { count: number; amount: number };
    balanceNetExcludingPayouts: number;
    /** balanceNetExcludingPayouts − everything accounted for above. Should be 0. */
    residual: number;
    payouts: { count: number; amount: number };
  };
  lastSyncedAt: string | null;
};
