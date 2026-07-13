// Designed as a replacement for member-search/route.ts
// Focused on returning memberships rather than memberships + profiles

import { requestWithProject } from "@/app/api/_common/endpoints";
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

    // All membership owner IDs now known — fetch transfer chains, events, and notes concurrently
    const allOwnerIds = (membershipResult.data || []).map((m) => m.owner_id);
    const allMembershipIds = (membershipResult.data || []).map((m) => m.id);

    t = Date.now();
    const [transferChainsResult, eventsResult, notesResult] = await Promise.all([
      allOwnerIds.length > 0
        ? supabase.rpc("get_transfer_chains", { p_owner_ids: allOwnerIds, p_project_id: project!.id })
        : Promise.resolve({ data: [], error: null }),
      supabase.from("burn_membership_checkin_events").select("membership_id, actor_profile_id, event_type, created_at").eq("project_id", project!.id).in("membership_id", allMembershipIds).order("created_at", { ascending: true }),
      supabase.from("burn_membership_notes").select("membership_id, actor_profile_id, note, created_at, special_circumstances").eq("project_id", project!.id).in("membership_id", allMembershipIds).order("created_at", { ascending: true }),
    ]);
    console.log(`[timing] transferChains + eventsResult + notesResult: ${Date.now() - t}ms`);

    const allTransfers: any[] = transferChainsResult.data || [];
    for (const tr of allTransfers) {
      if (tr.from_email) profileEmailsById[tr.from_owner_id] = tr.from_email;
      if (tr.to_email) profileEmailsById[tr.to_owner_id] = tr.to_email;
    }

    // Fetch emails for extra membership owners not yet known
    const newOwnerIds = allOwnerIds.filter((id: string) => !profileEmailsById[id]);
    if (newOwnerIds.length > 0) {
      const newProfilesResult = await supabase.from("profiles").select("id, email").in("id", newOwnerIds);
      for (const p of newProfilesResult.data || []) profileEmailsById[p.id] = p.email;
    }

    const events = eventsResult.data || [];
    const notes = notesResult.data || [];

    // Resolve actor emails and actor memberships concurrently
    const allActorProfileIds = [...new Set([
      ...events.map((e) => e.actor_profile_id),
      ...notes.map((n) => n.actor_profile_id),
    ])];
    const missingActorEmailIds = allActorProfileIds.filter((id) => !profileEmailsById[id]);
    t = Date.now();
    const [actorEmailsResult, actorMembershipsResult] = await Promise.all([
      missingActorEmailIds.length > 0
        ? supabase.from("profiles").select("id, email").in("id", missingActorEmailIds)
        : Promise.resolve({ data: [] }),
      allActorProfileIds.length > 0
        ? supabase.from("burn_memberships").select("owner_id, first_name, last_name").eq("project_id", project!.id).in("owner_id", allActorProfileIds)
        : Promise.resolve({ data: [] }),
    ]);
    console.log(`[timing] actorEmails + actorMemberships: ${Date.now() - t}ms`);
    for (const p of actorEmailsResult.data || []) profileEmailsById[p.id] = p.email;

    const actorNameByProfileId: Record<string, string> = {};
    for (const m of actorMembershipsResult.data || []) {
      actorNameByProfileId[m.owner_id] = `${m.first_name} ${m.last_name}`;
    }

    const resolveActorDisplayName = (profileId: string): string =>
      actorNameByProfileId[profileId] || profileEmailsById[profileId] || profileId;

    // Build transfer chain lookup maps
    const transferByRecipient = new Map<string, any>();
    for (const transfer of allTransfers) {
      if (!transferByRecipient.has(transfer.to_owner_id)) transferByRecipient.set(transfer.to_owner_id, transfer);
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

    const eventsByMembershipId: Record<string, { event_type: string; created_at: string; actor_display_name: string }[]> = {};
    for (const event of events) {
      if (!eventsByMembershipId[event.membership_id]) eventsByMembershipId[event.membership_id] = [];
      eventsByMembershipId[event.membership_id].push({
        event_type: event.event_type,
        created_at: event.created_at,
        actor_display_name: resolveActorDisplayName(event.actor_profile_id),
      });
    }

    const notesByMembershipId: Record<string, { note: string; created_at: string; actor_display_name: string; special_circumstances: boolean }[]> = {};
    for (const n of notes) {
      if (!notesByMembershipId[n.membership_id]) notesByMembershipId[n.membership_id] = [];
      notesByMembershipId[n.membership_id].push({
        note: n.note,
        created_at: n.created_at,
        actor_display_name: resolveActorDisplayName(n.actor_profile_id),
        special_circumstances: n.special_circumstances ?? false,
      });
    }

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
        check_in_events: eventsByMembershipId[membership.id] || [],
        notes: notesByMembershipId[membership.id] || [],
      })),
    };
  },
  SearchSchema,
  [BurnRole.MembershipManager, BurnRole.MembershipLead],
);
