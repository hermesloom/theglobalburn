import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole, Profile } from "@/utils/types";

let defaultScannerId = 999999999999;

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    let profiles =
      await query(() =>
        supabase
          .from("profiles")
          .select("*")
      )
    return profiles
      .filter((profile: Profile) => profile.metadata.scanner_id || profile.metadata.check_in_count)
      .sort((p1: Profile, p2: Profile) => {
        return(
          (p1.metadata.scanner_id || defaultScannerId) - (p2.metadata.scanner_id || defaultScannerId)
        )
      });
  },
  undefined,
  BurnRole.ThresholdWatcher
);

