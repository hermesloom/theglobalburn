import { requestWithMembership, query } from "@/app/api/_common/endpoints";
import { aggregateFinances } from "@/utils/stripe/attribution";
import {
  ALVERSJO_ADDON_ID,
  BalanceSummary,
  MembershipPaymentRow,
  TransferInput,
} from "@/utils/stripe/types";
import { stripeCurrenciesWithoutDecimals } from "@/app/api/_common/stripe";

export const GET = requestWithMembership(
  async (supabase, profile, request, body, project) => {
    const burnConfig = project!.burn_config;
    const currency = burnConfig.membership_price_currency;

    // burn_config stores prices in display units; the mirror is in minor units.
    const minorUnitFactor = stripeCurrenciesWithoutDecimals.includes(
      currency.toUpperCase(),
    )
      ? 1
      : 100;
    const alversjoPrice = Math.round(
      (burnConfig.membership_addons.find((a) => a.id === ALVERSJO_ADDON_ID)
        ?.price ?? 0) * minorUnitFactor,
    );

    const lastRun = await query(() =>
      supabase
        .from("stripe_sync_runs")
        .select("finished_at, stripe_account_id")
        .eq("project_id", project!.id)
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );

    const emptyBalance: BalanceSummary = {
      netExcludingPayouts: 0,
      payouts: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    };

    if (!lastRun) {
      return aggregateFinances({
        rows: [],
        projectId: project!.id,
        alversjoPrice,
        eventEndDate: new Date(burnConfig.event_end_date ?? Date.now()),
        currency,
        transfers: [],
        balanceSummary: emptyBalance,
        lastSyncedAt: null,
      });
    }

    const rows: MembershipPaymentRow[] = await query(() =>
      supabase.from("stripe_membership_payments").select("*"),
    );

    const balanceTransactions = await query(() =>
      supabase
        .from("stripe_balance_transactions")
        .select("type, amount, net, reporting_category")
        .eq("stripe_account_id", lastRun.stripe_account_id),
    );

    const balanceSummary: BalanceSummary = {
      netExcludingPayouts: 0,
      payouts: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    };
    for (const bt of balanceTransactions) {
      if (bt.type === "payout") {
        balanceSummary.payouts.count++;
        balanceSummary.payouts.amount += bt.amount;
        continue;
      }
      // `net` (amount minus the fee Stripe took), not `amount`: the sale rows are
      // reported net of fees, so summing gross here would leave the whole fee bill
      // sitting in the residual.
      balanceSummary.netExcludingPayouts += bt.net;
      // Dispute entries stay in the balance total — the money really did leave —
      // but must not enter `other`, because the sale rows already deduct the
      // disputed amount and its fee. Counting them here would subtract twice.
      if (
        bt.type !== "charge" &&
        bt.type !== "refund" &&
        bt.reporting_category !== "dispute"
      ) {
        balanceSummary.other.count++;
        balanceSummary.other.amount += bt.net;
      }
    }

    // Transfers are counted against the sale the *original* membership was bought
    // in, which its payment intent identifies. Requires the backfill script for the
    // pre-2026-03-14 rows to be present.
    const transfers = await query(() =>
      supabase
        .from("burn_membership_transfers")
        .select("original_membership_json, to_owner_id, created_at")
        .eq("project_id", project!.id),
    );
    const transferInputs: TransferInput[] = transfers.map((t: any) => ({
      fromPaymentIntentId:
        t.original_membership_json?.stripe_payment_intent_id ?? null,
      toOwnerId: t.to_owner_id ?? null,
      at: t.created_at,
    }));

    return aggregateFinances({
      rows,
      projectId: project!.id,
      alversjoPrice,
      eventEndDate: new Date(burnConfig.event_end_date ?? Date.now()),
      currency,
      transfers: transferInputs,
      balanceSummary,
      lastSyncedAt: lastRun.finished_at,
    });
  },
);
