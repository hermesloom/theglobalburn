import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    let profiles =
      await query(() =>
        supabase
          .from("profiles")
          .select("*")
      )
    return profiles.filter((profile) => profile.metadata.scanner_id);
  },
  undefined,
  BurnRole.ThresholdWatcher
);

