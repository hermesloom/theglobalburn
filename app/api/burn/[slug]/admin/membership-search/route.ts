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

    const profileEmailsById: Record<string, string> =
      Object.fromEntries(
        profileResult2.data.map(profile => [profile.id, profile.email])
      );

    // Fetch all transfers for this project to build transfer history chains
    const transfersResult = await supabase
      .from("burn_membership_transfers")
      .select("id, created_at, from_owner_id, to_owner_id, original_membership_json")
      .eq("project_id", project!.id)
      .order("created_at", { ascending: false });

    const allTransfers = transfersResult.data || [];

    // Collect profile IDs from transfers not already fetched
    const missingProfileIds = [...new Set([
      ...allTransfers.map(t => t.from_owner_id),
      ...allTransfers.map(t => t.to_owner_id),
    ])].filter(id => !profileEmailsById[id]);

    if (missingProfileIds.length > 0) {
      const extraProfilesResult = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", missingProfileIds);
      for (const p of extraProfilesResult.data || []) {
        profileEmailsById[p.id] = p.email;
      }
    }

    // Map: to_owner_id -> most recent transfer received
    const transferByRecipient = new Map<string, typeof allTransfers[0]>();
    // Map: from_owner_id -> transfer sent (for forward chain traversal)
    const transferBySender = new Map<string, typeof allTransfers[0]>();
    for (const transfer of allTransfers) {
      if (!transferByRecipient.has(transfer.to_owner_id)) {
        transferByRecipient.set(transfer.to_owner_id, transfer);
      }
      if (!transferBySender.has(transfer.from_owner_id)) {
        transferBySender.set(transfer.from_owner_id, transfer);
      }
    }

    // Follow forward chain to find current owner of a membership
    const findCurrentOwner = (ownerId: string, visited = new Set<string>()): string => {
      if (visited.has(ownerId)) return ownerId;
      visited.add(ownerId);
      const next = transferBySender.get(ownerId);
      if (!next) return ownerId;
      return findCurrentOwner(next.to_owner_id, visited);
    };

    console.log("[membership-search] allTransfers count:", allTransfers.length);
    console.log("[membership-search] profileEmailsById keys count:", Object.keys(profileEmailsById).length);

    // Find transfers matching search term (by previous owner name or email)
    const matchingTransfers = allTransfers.filter((t) => {
      const json = t.original_membership_json as any;
      const firstName = (json?.first_name || '').toLowerCase();
      const lastName = (json?.last_name || '').toLowerCase();
      const fromEmail = (profileEmailsById[t.from_owner_id] || '').toLowerCase();
      return (
        searchTerms.some((term: string) => firstName.includes(term) || lastName.includes(term)) ||
        fromEmail.includes(searchTerm)
      );
    });

    console.log("[membership-search] matchingTransfers count:", matchingTransfers.length, matchingTransfers.map(t => ({ from: profileEmailsById[t.from_owner_id], to: t.to_owner_id })));

    // Find current owner IDs for matching transfers not already in results
    const existingOwnerIds = new Set((membershipResult.data || []).map((m) => m.owner_id));
    const extraOwnerIds = [
      ...new Set(matchingTransfers.map((t) => findCurrentOwner(t.to_owner_id))),
    ].filter((id) => !existingOwnerIds.has(id));

    console.log("[membership-search] extraOwnerIds:", extraOwnerIds);

    if (extraOwnerIds.length > 0) {
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

      if (!extraMembershipsResult.error && extraMembershipsResult.data) {
        // Fetch emails for any new owners
        const newOwnerIds = extraMembershipsResult.data
          .map((m) => m.owner_id)
          .filter((id) => !profileEmailsById[id]);
        if (newOwnerIds.length > 0) {
          const newProfilesResult = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", newOwnerIds);
          for (const p of newProfilesResult.data || []) {
            profileEmailsById[p.id] = p.email;
          }
        }
        (membershipResult.data as any[]).push(...extraMembershipsResult.data);
      }
    }

    const buildTransferChain = (ownerId: string, visited = new Set<string>()): object[] => {
      if (visited.has(ownerId)) return [];
      visited.add(ownerId);
      const transfer = transferByRecipient.get(ownerId);
      if (!transfer) return [];
      const prior = buildTransferChain(transfer.from_owner_id, visited);
      return [
        ...prior,
        {
          created_at: transfer.created_at,
          from_owner_id: transfer.from_owner_id,
          from_first_name: (transfer.original_membership_json as any)?.first_name,
          from_last_name: (transfer.original_membership_json as any)?.last_name,
          from_email: profileEmailsById[transfer.from_owner_id],
          to_owner_id: transfer.to_owner_id,
          to_email: profileEmailsById[transfer.to_owner_id],
        },
      ];
    };

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
        transfer_history: buildTransferChain(membership.owner_id),
      })),
    };
  },
  SearchSchema,
  [BurnRole.MembershipManager, BurnRole.MembershipLead],
);
