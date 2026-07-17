import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { enrichMembershipSearchResults } from "@/app/api/_common/enrichMembershipSearchResults";
import { BurnRole } from "@/utils/types";

const LIMIT = 40;

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const memberships: any[] = await query(() =>
      supabase
        .from("burn_memberships")
        .select(`
          id,
          owner_id,
          first_name,
          last_name,
          checked_in_at,
          birthdate,
          metadata->children,
          metadata->pets,
          metadata->emergency_info->camp_name,
          metadata->emergency_info->phone_number,
          metadata->emergency_info->emergency_contact_onsite,
          metadata->emergency_info->emergency_contact_other,
          metadata->car_registration
        `)
        .eq("project_id", project!.id)
        .not("checked_in_at", "is", null)
        .order("checked_in_at", { ascending: false })
        .limit(LIMIT)
    );

    return enrichMembershipSearchResults(supabase, memberships, project!.id);
  },
  undefined,
  [BurnRole.MembershipManager, BurnRole.MembershipLead],
);
