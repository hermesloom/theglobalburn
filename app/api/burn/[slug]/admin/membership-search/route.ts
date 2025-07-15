// Designed as a replacement for member-search/route.ts
// Focused on returning memberships rather than memberships + profiles

import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";
import s from "ajv-ts";
const SearchSchema = s.object({
  q: s.string(),
});

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    let searchTerm = body.q.toLowerCase();

    const searchTerms = searchTerm.trim().split(/\s+/);

    // Query profiles for email matches
    let profileResult = await supabase
      .from("profiles")
      .select(`id`)
      .ilike("email", `%${searchTerm}%`);

    if (profileResult.error) {
      console.error("Error fetching profiles:", profileResult.error);
      return [];
    }

    let profileIds = profileResult.data.map((result) => result.id)

    let { data: membershipResults, error: membershipError } = await supabase
      .from("burn_memberships")
      .select(`
        owner_id,
        first_name,
        last_name,
        checked_in_at,
        metadata
      `)
      .or([
        ...searchTerms.map((term: string) =>
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%`
        ),
        ...profileIds.map(id => `owner_id.eq.${id}`)
      ])
      .eq("project_id", project!.id);

    const countOfTermsMatched = (result: {first_name: string, last_name: string}) => {
      return(
        searchTerms.filter((term: string) => {
          return(result.first_name.toLowerCase().match(term) || result.last_name.toLowerCase().match(term))
        }).length
      );
    }

    if (membershipError) {
      console.error("Error fetching memberships:", membershipError);
      return [];
    }

    membershipResults =
      (membershipResults || []).sort((a, b) => {
        return(
          countOfTermsMatched(b) - countOfTermsMatched(a)
        )
      })

    profileResult = await supabase
      .from("profiles")
      .select(`id, email`)
      .in('id', membershipResults.map((r) => r.owner_id));

    if (profileResult.error) {
      console.error("Error fetching profiles (second time):", profileResult.error);
      return [];
    }

    let profileEmailsById =
      Object.fromEntries(
        profileResult.data.map(profile => [profile.id, profile.email])
      );

    console.log(profileEmailsById)
    console.log(membershipResults)

    return {
      data: membershipResults.map((membership) => ({
        ...membership,
        profile: {
          email: profileEmailsById[membership.owner_id]
        },
      })),
    };
  },
  SearchSchema,
  [BurnRole.MembershipManager, BurnRole.ThresholdWatcher],
);
