import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";

// TODO: `profiles` aren't linked to a burn, so how to deal with scanners?  Maybe they're global?
export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    let parts = request.nextUrl.pathname.split("/");
    parts.pop()
    const profileId = parts.pop()

    let [foundMembership] = await query(() =>
      supabase
        .from("burn_memberships")
        .select("*")
        .eq("owner_id", profileId)
    );

    const newMetaData = foundMembership?.metadata ?? {};

    newMetaData["check_in_reset_actions"] = newMetaData["check_in_resets"] || [];
    newMetaData["check_in_reset_actions"].push({profileId: profile.id, dateTime: new Date().toISOString()})

    await query(() =>
      supabase
        .from("burn_memberships")
        .update({ checked_in_at: null, metadata: newMetaData })
        .eq("id", foundMembership.id)
    );


  },
  undefined,
  BurnRole.ThresholdWatcher
);

