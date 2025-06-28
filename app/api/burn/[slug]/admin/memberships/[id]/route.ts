import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole, BurnMembership } from "@/utils/types";
import Stripe from "stripe";

import * as uuid from "uuid";

export const DELETE = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const id = request.nextUrl.pathname.split("/").pop();

    const membership: BurnMembership = await query(() =>
      supabase.from("burn_memberships").select("*").eq("id", id).single()
    );

    if (membership.stripe_payment_intent_id) {
      const stripe = new Stripe(project!.burn_config.stripe_secret_api_key);
      await stripe.refunds.create({
        payment_intent: membership.stripe_payment_intent_id,
      });
    }

    return await query(() =>
      supabase.from("burn_memberships").delete().eq("id", id)
    );
  },
  undefined,
  BurnRole.MembershipManager
);
