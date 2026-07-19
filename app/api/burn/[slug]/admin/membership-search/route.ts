// Designed as a replacement for member-search/route.ts
// Focused on returning memberships rather than memberships + profiles

import { requestWithProject } from "@/app/api/_common/endpoints";
import { enrichMembershipSearchResults } from "@/app/api/_common/enrichMembershipSearchResults";
import { BurnRole } from "@/utils/types";
import s from "ajv-ts";
const SearchSchema = s.object({
  q: s.string(),
});

const pageSize = 500;

const normalizeRegistrationPlate = (string: string) => {
  return string.replace(/[\s\-]+/g, '').trim().toLowerCase();
}

const normalizeTerm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const searchTerm = normalizeTerm(body.q);
    const page = (body.page || 0);

    const searchTerms = searchTerm.trim().split(/\s+/);
    const normalizedSearchTerm = normalizeRegistrationPlate(searchTerm);

    // Query profiles for email matches and all plates concurrently
    let t = Date.now();
    const [profileResult, platesResult] = await Promise.all([
      supabase.from("profiles").select(`id`).ilike("email", `%${searchTerm}%`),
      supabase.from("burn_memberships").select(`id, metadata->car_registration->>registration_plate`).eq("project_id", project!.id).not("metadata->car_registration->>registration_plate", "is", null),
    ]);
    console.log(`[timing] profileResult + platesResult: ${Date.now() - t}ms`);

    if (profileResult.error) {
      console.error("Error fetching profiles:", profileResult.error);
      return { error: profileResult.error };
    }

    const profileIds = profileResult.data.map((result) => result.id)

    const plateMatchIds: string[] = (platesResult.data || [])
      .filter((r) => {
        const plate = (r as any).registration_plate as string | null;
        return plate != null && normalizeRegistrationPlate(plate).includes(normalizedSearchTerm); // ponytail: plate != null guard kept — TS doesn't know the DB filter holds
      })
      .map((r) => r.id);

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
          metadata->children,
          metadata->pets,
          metadata->emergency_info->camp_name,
          metadata->emergency_info->phone_number,
          metadata->emergency_info->emergency_contact_onsite,
          metadata->emergency_info->emergency_contact_other,
          metadata->car_registration
        `)
        .eq("project_id", project!.id)
        .range(
          page * pageSize,
          ((page + 1) * pageSize) - 1
        );

    membershipQuery =
      membershipQuery
        .or([
          ...searchTerms.map((term: string) =>
            `first_name.ilike.%${term}%,last_name.ilike.%${term}%,metadata->emergency_info->>camp_name.ilike.%${term}%,metadata->car_registration->>registration_plate.ilike.%${term}%,metadata->car_registration->>camp_or_area.ilike.%${term}%`
          ),
          ...profileIds.map(id => `owner_id.eq.${id}`),
          ...(plateMatchIds.length > 0 ? [`id.in.(${plateMatchIds.join(',')})`] : [])
        ].join(','))

    t = Date.now();
    const membershipResult = await membershipQuery;
    console.log(`[timing] membershipQuery: ${Date.now() - t}ms (${membershipResult.data?.length ?? 0} rows)`);

    const countOfTermsMatched = (result: { first_name: string, last_name: string, camp_name?: string | null, car_registration?: any }) => {
      return (
        searchTerms.filter((term: string) => {
          return (
            normalizeTerm(result.first_name).includes(term) ||
            normalizeTerm(result.last_name).includes(term) ||
            (result.camp_name && normalizeTerm(result.camp_name).includes(term)) ||
            result.car_registration?.registration_plate?.replace(/\s+/g, '').toLowerCase().includes(normalizedSearchTerm) ||
            (result.car_registration?.camp_or_area && normalizeTerm(result.car_registration.camp_or_area).includes(term))
          );
        }).length
      );
    }

    if (membershipResult.error) {
      console.error("Error fetching memberships:", membershipResult.error);
      return { error: membershipResult.error };
    }

    const foundOwnerIds = (membershipResult.data || []).map((m) => m.owner_id);

    // Fetch owner emails and search transfers by previous owner concurrently.
    // search_transfers_by_previous_owner only runs on page 0 — transfer matches are not paginated.
    t = Date.now();
    const [profileResult2, prevOwnerSearchResult] = await Promise.all([
      supabase.from("profiles").select(`id,email`).in('id', foundOwnerIds),
      page === 0
        ? supabase.rpc("search_transfers_by_previous_owner", { p_search_terms: searchTerms, p_search_term: searchTerm, p_project_id: project!.id })
        : Promise.resolve({ data: [], error: null }),
    ]);
    console.log(`[timing] profileResult2 + prevOwnerSearch: ${Date.now() - t}ms`);

    if (profileResult2.error) {
      console.error("Error fetching profiles (second time):", profileResult2.error);
      return { error: profileResult2.error };
    }

    const profileEmailsById: Record<string, string> =
      Object.fromEntries(
        profileResult2.data.map((p: any) => [p.id, p.email])
      );

    // Fetch extra memberships whose current owner was found via transfer history search
    const existingOwnerIds = new Set(foundOwnerIds);
    const extraOwnerIds = page === 0
      ? [...new Set((prevOwnerSearchResult.data || []).map((r: any) => r.current_owner_id as string))].filter((id) => !existingOwnerIds.has(id))
      : [];

    if (extraOwnerIds.length > 0) {
      t = Date.now();
      const extraMembershipsResult = await supabase
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
        .in("owner_id", extraOwnerIds);
      console.log(`[timing] extraMemberships (${extraOwnerIds.length} owners): ${Date.now() - t}ms`);

      if (!extraMembershipsResult.error && extraMembershipsResult.data) {
        (membershipResult.data as any[]).push(...extraMembershipsResult.data);
      }
    }

    const allMemberships = (membershipResult.data || []).sort(
      (a, b) => countOfTermsMatched(b as any) - countOfTermsMatched(a as any)
    );

    const enriched = await enrichMembershipSearchResults(
      supabase,
      allMemberships,
      project!.id,
      profileEmailsById,
    );

    return { data: enriched };
  },
  SearchSchema,
  [BurnRole.MembershipManager, BurnRole.MembershipLead],
);
