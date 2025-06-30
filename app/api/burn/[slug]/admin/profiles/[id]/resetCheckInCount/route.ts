import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";

// TODO: `profiles` aren't linked to a burn, so how to deal with scanners?  Maybe they're global?
export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    let parts = request.nextUrl.pathname.split("/");
    parts.pop()
    const id = parts.pop()

    let [foundProfile] = await query(() =>
      supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
    );

    const newMetaData = foundProfile?.metadata ?? {};

    newMetaData["check_in_count"] = 0;

    await query(() =>
      supabase
        .from("profiles")
        .update({ metadata: newMetaData })
        .eq("id", id)
    );


  },
  undefined,
  BurnRole.ThresholdWatcher
);

