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

export type SyncCursors = Record<
  string,
  { startingAfter?: string; done?: boolean }
>;
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
