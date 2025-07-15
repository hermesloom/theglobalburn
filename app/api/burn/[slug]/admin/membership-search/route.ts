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
      // return [];
      return {error: profileResult.error};
    }

    let profileIds = profileResult.data.map((result) => result.id)

    let membershipQuery =
      supabase
        .from("burn_memberships")
        .select(`
          id,
          owner_id,
          first_name,
          last_name,
          checked_in_at,
          birthdate,
          metadata->children
          metadata->pets
        `)
        .eq("project_id", project!.id);

    if (searchTerm != 'all hail the jort') {
      membershipQuery =
        membershipQuery
        .or([
          ...searchTerms.map((term: string) =>
            `first_name.ilike.%${term}%,last_name.ilike.%${term}%`
          ),
          ...profileIds.map(id => `owner_id.eq.${id}`)
        ].join(','))
    }

    let membershipResult = await membershipQuery;

    const countOfTermsMatched = (result: {first_name: string, last_name: string}) => {
      return(
        searchTerms.filter((term: string) => {
          return(result.first_name.toLowerCase().match(term) || result.last_name.toLowerCase().match(term))
        }).length
      );
    }

    if (membershipResult.error) {
      console.error("Error fetching memberships:", membershipResult.error);
      // return [];
      return {error: membershipResult.error};
    }

    let profileResult2 = await supabase
      .from("profiles")
      .select(`id,email`)
      .in('id', membershipResult.data.map((r) => r.owner_id));

    if (profileResult2.error) {
      console.error("Error fetching profiles (second time):", profileResult2.error);
      // return [];
      return {error: profileResult2.error};
    }

    let profileEmailsById =
      Object.fromEntries(
        profileResult2.data.map(profile => [profile.id, profile.email])
      );

    return {
      data: (membershipResult.data || []).sort((a, b) => {
        return(
          countOfTermsMatched(b) - countOfTermsMatched(a)
        )
      }).map((membership) => ({
        ...membership,
        metadata: {
          children: membership.children,
          pets: membership.pets,
        },
        profile: {
          email: profileEmailsById[membership.owner_id]
        },
      })),
    };
  },
  SearchSchema,
  [BurnRole.MembershipManager, BurnRole.ThresholdWatcher],
);
