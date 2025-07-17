import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole, BurnMembership } from "@/utils/types";

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const memberships: BurnMembership[] = await query(() =>
      supabase.from("burn_memberships").select("id"),
    );

    return memberships.map((m) => m.id);
  },
  undefined,
  BurnRole.MembershipManager,
);
