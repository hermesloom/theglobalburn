import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";
import s from "ajv-ts";
const SearchSchema = s.object({
  q: s.string(),
});
export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    // console.log(request);
    // console.log(body);
    const searchTerm = body.q;

    const { data: membershipResults, error: membershipError } = await supabase
      .from("burn_memberships")
      .select(
        `
      owner_id,
      first_name,
      last_name,
      checked_in_at,
      metadata
    `,
      )
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
      .eq("project_id", project!.id);

    console.log({membershipResults})
    if (membershipError) {
      console.error("Error fetching memberships:", membershipError);
      return [];
    }

    // Query profiles for email matches
    const { data: profileResults, error: profileError } = await supabase
      .from("profiles")
      .select(`
      id,
      email,
      metadata
    `)
      .ilike("email", `%${searchTerm}%`);

    console.log({profileResults})

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
  BurnRole.MembershipManager,
);
