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

    let { data: membershipResults, error: membershipError } = await supabase
      .from("burn_memberships")
      .select(`
        owner_id,
        first_name,
        last_name,
        checked_in_at,
        metadata
      `)
      .or(
        searchTerms.map((term: string) =>
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%`
        ).join(',')
      )
      .eq("project_id", project!.id);

    const countOfTermsMatched = (result: {first_name: string, last_name: string}) => {
      return(
        searchTerms.filter((term: string) => {
          return(result.first_name.match(term) || result.last_name.match(term))
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

    // Query profiles for email matches
    const { data: profileResults, error: profileError } = await supabase
      .from("profiles")
      .select(`
      id,
      email,
      metadata
    `)
      .ilike("email", `%${searchTerm}%`);

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
      return [];
    }

    // Merge results based on matching profile IDs
    const mergedResults = membershipResults.map((membership) => {
      const profile = profileResults.find((p) => p.id === membership.owner_id);
      return {
        ...membership,
        email: profile ? profile.email : null,
      };
    });

    // Add profiles that matched by email but don't have corresponding memberships
    profileResults.forEach((profile) => {
      if (!mergedResults.some((result) => result.owner_id === profile.id)) {
        mergedResults.push({
          owner_id: profile.id,
          first_name: null,
          last_name: null,
          checked_in_at: null,
          email: profile.email,
          metadata: profile.metadata,
        });
      }
    });

    return {
      data: mergedResults,
    };
  },
  SearchSchema,
  [BurnRole.MembershipManager, BurnRole.ThresholdWatcher],
);
