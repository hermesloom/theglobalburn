import { requestWithProject } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";

export const GET = requestWithProject(
  async (supabase, profile, _request, _body, project) => {
    return {
      hasMembership: !!project?.membership,
    };
  },
  undefined,
  BurnRole.Participant
);
