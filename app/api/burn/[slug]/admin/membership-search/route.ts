// Designed as a replacement for member-search/route.ts
// Focused on returning memberships rather than memberships + profiles

import { requestWithProject } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";
import s from "ajv-ts";
const SearchSchema = s.object({
  q: s.string(),
});

const pageSize = 500;

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const searchTerm = body.q.toLowerCase();
    const page = (body.page || 0);

    const searchTerms = searchTerm.trim().split(/\s+/);
    const normalizedSearchTerm = searchTerm.replace(/\s+/g, '');

    // Query profiles for email matches
    const profileResult = await supabase
      .from("profiles")
      .select(`id`)
      .ilike("email", `%${searchTerm}%`);

    if (profileResult.error) {
      console.error("Error fetching profiles:", profileResult.error);
      // return [];
      return { error: profileResult.error };
    }

    const profileIds = profileResult.data.map((result) => result.id)

    // Fetch all plates for space-insensitive matching (can't use SQL expressions in PostgREST filters)
    const platesResult = await supabase
      .from("burn_memberships")
      .select(`id, metadata->car_registration->>registration_plate`)
      .eq("project_id", project!.id);

    const plateMatchIds: string[] = (platesResult.data || [])
      .filter((r) => {
        const plate = (r as any).registration_plate as string | null;
        return plate?.replace(/\s+/g, '').toLowerCase().includes(normalizedSearchTerm);
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

    const membershipResult = await membershipQuery;

    const countOfTermsMatched = (result: { first_name: string, last_name: string, camp_name?: string | null, car_registration?: any }) => {
      return (
        searchTerms.filter((term: string) => {
          return (
            result.first_name.toLowerCase().match(term) ||
            result.last_name.toLowerCase().match(term) ||
            result.camp_name?.toLowerCase().match(term) ||
            result.car_registration?.registration_plate?.replace(/\s+/g, '').toLowerCase().includes(normalizedSearchTerm) ||
            result.car_registration?.camp_or_area?.toLowerCase().match(term)
          );
        }).length
      );
    }

    if (membershipResult.error) {
      console.error("Error fetching memberships:", membershipResult.error);
      // return [];
      return { error: membershipResult.error };
    }

    const profileResult2 = await supabase
      .from("profiles")
      .select(`id,email`)
      .in('id', membershipResult.data.map((r) => r.owner_id));

    if (profileResult2.error) {
      console.error("Error fetching profiles (second time):", profileResult2.error);
      // return [];
      return { error: profileResult2.error };
    }

    const profileEmailsById =
      Object.fromEntries(
        profileResult2.data.map(profile => [profile.id, profile.email])
      );

    return {
      data: (membershipResult.data || []).sort((a, b) => {
        return (
          countOfTermsMatched(b as any) - countOfTermsMatched(a as any)
        )
      }).map((membership) => ({
        ...membership,
        metadata: {
          children: membership.children,
          pets: membership.pets,
          camp_name: membership.camp_name,
          phone_number: membership.phone_number,
          emergency_contact_onsite: membership.emergency_contact_onsite,
          emergency_contact_other: membership.emergency_contact_other,
          car_registration: membership.car_registration,
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
