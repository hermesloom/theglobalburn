import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole, Profile } from "@/utils/types";

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    let parts = request.nextUrl.pathname.split("/");
    parts.pop()
    const id = parts.pop()

    let foundProfiles = await query(() =>
      supabase
        .from("profiles")
        .select("*")
        .ilike("email", `threshold+scanner%@theborderland.se`)
    );

    console.log({foundProfiles})

    foundProfiles.forEach(async (profile : Profile) => {
      let result = profile.email.match(/^threshold\+scanner(\d+)@theborderland\.se$/)

      if (result) {
        let newMetaData = profile?.metadata ?? {};

        newMetaData["scanner_id"] = parseInt(result[1]);

        await query(() =>
          supabase
            .from("profiles")
            .update({ metadata: newMetaData })
            .eq("id", profile.id)
        );
      }
    })

  },
  undefined,
  BurnRole.ThresholdWatcher
);

