import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole, Profile } from "@/utils/types";

const defaultScannerId = 999999999999;

export const GET = requestWithProject(
  async (supabase, _profile, _request, _body, _project) => {
    const profiles =
      await query(() =>
        supabase
          .from("profiles")
          .select("*")
      )
    return profiles
      .filter((p: Profile) => (p.metadata.scanner_id != null) || (p.metadata.check_in_count != null))
      .sort((p1: Profile, p2: Profile) => {
        return(
          (p1.metadata.scanner_id || defaultScannerId) - (p2.metadata.scanner_id || defaultScannerId)
        )
      });
  },
  undefined,
  BurnRole.ThresholdWatcher
);

