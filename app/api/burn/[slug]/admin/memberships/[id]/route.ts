import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole, BurnMembership } from "@/utils/types";
import Stripe from "stripe";

import * as uuid from "uuid";

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const id = request.nextUrl.pathname.split("/").pop();

    if (!uuid.validate(id)) {
      return NextResponse.json({ error: "Invalid id (should be a UUID)" }, { status: 400 });
    }

    let [result] = await query(() =>
      supabase
        .from("burn_memberships")
        .select("*")
        .eq("id", id)
        .eq("project_id", project!.id)
    );

    if (!result) {
      return NextResponse.json({ error: "No member found" }, { status: 404 });
    }

    if (!result.checked_in_at) {
      const newMetaData = profile?.metadata ?? {};

      if (newMetaData["check_in_count"] === undefined) {
        newMetaData["check_in_count"] = 0;
      }
      newMetaData["check_in_count"] = newMetaData["check_in_count"] + 1;

      await query(() =>
        supabase
          .from("profiles")
          .update({ metadata: newMetaData })
          .eq("id", profile.id)
      );
    }

    return {
      id: result.id,
      first_name: result.first_name,
      last_name: result.last_name,
      birthdate: result.birthdate,
      checked_in_at: result.checked_in_at,
      metadata: {
        children: result.metadata.children,
        pets: result.metadata.pets,
      }
    }
  },
  undefined,
  BurnRole.MembershipScanner
);


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
