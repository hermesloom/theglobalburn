import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole, BurnMembership } from "@/utils/types";
import Stripe from "stripe";

import * as uuid from "uuid";

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const id = request.nextUrl.pathname.split("/").pop();

    if (!uuid.validate(id)) {
      return NextResponse.json({ error: "Invalid id (should be a UUID)" }, { status: 400 });
    }

    let [foundMembership] = await query(() =>
      supabase
        .from("burn_memberships")
        .select("*")
        .eq("id", id)
        .eq("project_id", project!.id)
    );

    if (!foundMembership) {
      return NextResponse.json({ error: "No member found" }, { status: 404 });
    }

    if (foundMembership.checked_in_at) {
      const newMetaData = profile?.metadata ?? {};

      // This... **shouldn't** happen because the UI should only trigger this route
      // when the account has *just* checked somebody in... but... better maybe to
      // not fail, just in case?? 🤷‍♂️
      if (newMetaData["check_in_count"] === undefined) {
        newMetaData["check_in_count"] = -1;
      }
      newMetaData["check_in_count"] = newMetaData["check_in_count"] - 1;

      await query(() =>
        supabase
          .from("profiles")
          .update({ metadata: newMetaData })
          .eq("id", profile.id)
      );

      await query(() =>
        supabase
          .from("burn_memberships")
          .update({ checked_in_at: null })
          .eq("id", foundMembership.id)
      );
    }

    return {
      status: "DONE"
    }
  },
  undefined,
  BurnRole.MembershipScanner
);

