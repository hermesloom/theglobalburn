import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  runSyncSlice,
  SYNC_RESOURCES,
  SYNC_START_ISO,
  SyncCursors,
} from "@/utils/stripe/sync";

const StripeSyncRequestSchema = s.object({
  mode: s.string().optional(),
});

/** Leaves headroom under Vercel's ~15s default function timeout. */
const SLICE_BUDGET_MS = 9_000;
/** Re-scan window for incremental runs, so late-arriving objects are not missed. */
const INCREMENTAL_OVERLAP_DAYS = 7;

export const POST = requestWithProject<
  s.infer<typeof StripeSyncRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const apiKey = project!.burn_config.stripe_secret_api_key;
    if (!apiKey) {
      return NextResponse.json(
        { error: "No Stripe API key configured for this burn" },
        { status: 400 },
      );
    }

    const stripe = new Stripe(apiKey);
    const account = await stripe.accounts.retrieve();

    // Resume the run still in progress, if there is one.
    const running = await query(() =>
      supabase
        .from("stripe_sync_runs")
        .select("*")
        .eq("project_id", project!.id)
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );

    let run = running;
    let createdGteIso = SYNC_START_ISO;

    if (!run) {
      const mode = body.mode === "full" ? "full" : "incremental";
      if (mode === "incremental") {
        const lastCompleted = await query(() =>
          supabase
            .from("stripe_sync_runs")
            .select("finished_at")
            .eq("project_id", project!.id)
            .eq("status", "completed")
            .order("finished_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        );
        if (lastCompleted?.finished_at) {
          const from = new Date(lastCompleted.finished_at);
          from.setUTCDate(from.getUTCDate() - INCREMENTAL_OVERLAP_DAYS);
          createdGteIso = new Date(
            Math.max(from.getTime(), Date.parse(SYNC_START_ISO)),
          ).toISOString();
        }
      }
      run = await query(() =>
        supabase
          .from("stripe_sync_runs")
          .insert({
            project_id: project!.id,
            stripe_account_id: account.id,
            mode,
            cursors: { _createdGteIso: createdGteIso },
            counts: {},
          })
          .select()
          .single(),
      );
    }

    const cursors: SyncCursors = { ...(run.cursors ?? {}) };
    createdGteIso = (cursors as any)._createdGteIso ?? SYNC_START_ISO;

    try {
      const result = await runSyncSlice({
        stripe,
        accountId: account.id,
        createdGteIso,
        cursors,
        counts: run.counts ?? {},
        budgetMs: SLICE_BUDGET_MS,
        now: () => Date.now(),
        upsert: async (table, rows) => {
          await query(() =>
            supabase.from(table).upsert(rows, { onConflict: "id" }),
          );
        },
      });

      (result.cursors as any)._createdGteIso = createdGteIso;

      if (result.done) {
        await refreshMutatedCharges(supabase, stripe, account.id, createdGteIso);
      }

      await query(() =>
        supabase
          .from("stripe_sync_runs")
          .update({
            cursors: result.cursors,
            counts: result.counts,
            status: result.done ? "completed" : "running",
            finished_at: result.done ? new Date().toISOString() : null,
          })
          .eq("id", run.id),
      );

      return {
        runId: run.id,
        done: result.done,
        counts: result.counts,
        resource:
          SYNC_RESOURCES.find((r) => !result.cursors[r.name]?.done)?.name ??
          null,
      };
    } catch (error: any) {
      await query(() =>
        supabase
          .from("stripe_sync_runs")
          .update({ status: "failed", error: error.message ?? String(error) })
          .eq("id", run.id),
      );
      throw error;
    }
  },
  StripeSyncRequestSchema,
  BurnRole.Admin,
);

/**
 * charge.amount_refunded changes long after the charge was created, so a sync
 * filtered on `created` alone would leave stale charges behind. Re-fetch by id every
 * charge that a refund or dispute in the synced window points at.
 */
async function refreshMutatedCharges(
  supabase: any,
  stripe: Stripe,
  accountId: string,
  createdGteIso: string,
) {
  const refunds = await query(() =>
    supabase
      .from("stripe_refunds")
      .select("charge_id")
      .eq("stripe_account_id", accountId)
      .gte("created_at", createdGteIso)
      .not("charge_id", "is", null),
  );
  const disputes = await query(() =>
    supabase
      .from("stripe_disputes")
      .select("charge_id")
      .eq("stripe_account_id", accountId)
      .gte("created_at", createdGteIso)
      .not("charge_id", "is", null),
  );

  const chargeIds = Array.from(
    new Set(
      [...refunds, ...disputes].map((r: any) => r.charge_id).filter(Boolean),
    ),
  );
  const chargeResource = SYNC_RESOURCES.find((r) => r.name === "charges")!;

  for (const chargeId of chargeIds) {
    const charge = await stripe.charges.retrieve(chargeId as string);
    await query(() =>
      supabase
        .from(chargeResource.table)
        .upsert([chargeResource.map(charge, accountId)], { onConflict: "id" }),
    );
  }
}
