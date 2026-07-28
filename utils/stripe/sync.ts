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
