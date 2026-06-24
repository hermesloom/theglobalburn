import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole } from "@/utils/types";

// TODO: `profiles` aren't linked to a burn, so how to deal with scanners?  Maybe they're global?
export const POST = requestWithProject(
  async (supabase, profile, request, _body, project) => {
    const parts = request.nextUrl.pathname.split("/");
    parts.pop()
    const profileId = parts.pop()

    const [foundMembership] = await query(() =>
      supabase
        .from("burn_memberships")
        .select("*")
        .eq("owner_id", profileId)
        .eq("project_id", project!.id)
    );

    if (!foundMembership) {
      return NextResponse.json({ error: "No membership found" }, { status: 404 });
    }

    await query(() =>
      supabase
        .from("burn_memberships")
        .update({ checked_in_at: null })
        .eq("id", foundMembership.id)
    );

    await query(() =>
      supabase
        .from("burn_membership_checkin_events")
        .insert({
          project_id: foundMembership.project_id,
          membership_id: foundMembership.id,
          actor_profile_id: profile.id,
          event_type: "check_out",
        })
    );

  },
  undefined,
  BurnRole.MembershipLead
);

