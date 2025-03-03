import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";
import { getAvailableMemberships } from "@/app/api/_common/profile";

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    return await getAvailableMemberships(supabase, project!);
  },
  undefined,
  BurnRole.Participant,
);
