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
  /** fee + fee_refunded. */
  netFee: number;
  /** Money the cardholder's bank took back, plus Stripe's dispute fee. */
  chargeback: number;
};

export type SaleTotals = {
  /** Net of refunds and disputes, excluding Alversjö. */
  membershipIncome: number;
  alversjoIncome: number;
  /** membershipIncome + alversjoIncome — the Operating income row. */
  operatingIncome: number;
  /** Net of fee refunds, including dispute fees. */
  stripeFees: number;
  /** Money taken back by cardholders, including Stripe's dispute fees. */
  chargebacks: number;
  /** operatingIncome − stripeFees − chargebacks. */
  netKept: number;
  payments: number;
  refunds: number;
  transfers: number;
  /** Memberships currently held that were bought in this sale. */
  memberships: number;
  /** How many of those memberships were checked in at the gate. */
  checkedIn: number;
  /** Alversjö addon sold, before refunds. */
  alversjoGross: number;
  /** Alversjö's share of refunds, capped at what it received. */
  alversjoRefunded: number;
  /** Alversjö's share of Stripe fees, prorated by amount. */
  alversjoFee: number;
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

/** One currently-held membership, for counting by the sale it was bought in. */
export type MembershipCountInput = {
  /** Identifies the payment, and so the sale. Null for pre-Stripe memberships. */
  paymentIntentId: string | null;
  checkedIn: boolean;
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

export type FinancesPayload = {
  currency: string;
  fall: SaleTotals;
  spring: SaleTotals;
  total: SaleTotals;
  /** Free memberships with no Stripe payment, for carers. Counted in the total. */
  carerMemberships: number;
  alversjoInvoice: AlversjoInvoice;
  lastSyncedAt: string | null;
};
