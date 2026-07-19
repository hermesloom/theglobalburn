import { SupabaseClient } from "@supabase/supabase-js";

async function fetchMissingEmails(
  supabase: SupabaseClient,
  ids: string[],
  emailsById: Record<string, string>,
): Promise<void> {
  const missing = ids.filter((id) => !emailsById[id]);
  if (missing.length === 0) return;
  const { data } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", missing);
  for (const p of data || []) emailsById[p.id] = p.email;
}

async function buildActorResolver(
  supabase: SupabaseClient,
  events: any[],
  notes: any[],
  projectId: string,
  emailsById: Record<string, string>,
): Promise<(profileId: string) => string> {
  const actorIds = [
    ...new Set([
      ...events.map((e) => e.actor_profile_id),
      ...notes.map((n) => n.actor_profile_id),
    ]),
  ];

  const [, membershipsResult] = await Promise.all([
    fetchMissingEmails(supabase, actorIds, emailsById),
    actorIds.length > 0
      ? supabase
          .from("burn_memberships")
          .select("owner_id, first_name, last_name")
          .eq("project_id", projectId)
          .in("owner_id", actorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameById: Record<string, string> = {};
  for (const m of (membershipsResult as any).data || [])
    nameById[m.owner_id] = `${m.first_name} ${m.last_name}`;

  return (profileId: string) =>
    nameById[profileId] || emailsById[profileId] || profileId;
}

function buildTransferChainWalker(
  transfers: any[],
  emailsById: Record<string, string>,
): (ownerId: string) => object[] {
  const byRecipient = new Map<string, any>();
  for (const t of transfers) {
    if (!byRecipient.has(t.to_owner_id)) byRecipient.set(t.to_owner_id, t);
  }

  const walk = (ownerId: string, visited = new Set<string>()): object[] => {
    if (visited.has(ownerId)) return [];
    visited.add(ownerId);
    const t = byRecipient.get(ownerId);
    if (!t) return [];
    return [
      ...walk(t.from_owner_id, visited),
      {
        created_at: t.created_at,
        from_owner_id: t.from_owner_id,
        from_first_name: (t.original_membership_json as any)?.first_name,
        from_last_name: (t.original_membership_json as any)?.last_name,
        from_email: emailsById[t.from_owner_id],
        to_owner_id: t.to_owner_id,
        to_email: emailsById[t.to_owner_id],
      },
    ];
  };

  return walk;
}

function groupEventsByMembership(
  events: any[],
  resolveActor: (id: string) => string,
): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  for (const e of events) {
    (map[e.membership_id] ??= []).push({
      event_type: e.event_type,
      created_at: e.created_at,
      actor_display_name: resolveActor(e.actor_profile_id),
    });
  }
  return map;
}

function groupNotesByMembership(
  notes: any[],
  resolveActor: (id: string) => string,
): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  for (const n of notes) {
    (map[n.membership_id] ??= []).push({
      note: n.note,
      created_at: n.created_at,
      actor_display_name: resolveActor(n.actor_profile_id),
      special_circumstances: n.special_circumstances ?? false,
    });
  }
  return map;
}

/**
 * Enriches raw burn_memberships rows with transfer chains, check-in events,
 * notes, and resolved emails/names. Pass knownEmailsById to skip redundant
 * profile lookups the caller already made.
 */
export async function enrichMembershipSearchResults(
  supabase: SupabaseClient,
  memberships: any[],
  projectId: string,
  knownEmailsById: Record<string, string> = {},
): Promise<any[]> {
  if (memberships.length === 0) return [];

  const emailsById: Record<string, string> = { ...knownEmailsById };
  const ownerIds = memberships.map((m) => m.owner_id);
  const membershipIds = memberships.map((m) => m.id);

  const [, transferChainsResult, eventsResult, notesResult] = await Promise.all([
    fetchMissingEmails(supabase, ownerIds, emailsById),
    supabase.rpc("get_transfer_chains", {
      p_owner_ids: ownerIds,
      p_project_id: projectId,
    }),
    supabase
      .from("burn_membership_checkin_events")
      .select("membership_id, actor_profile_id, event_type, created_at")
      .eq("project_id", projectId)
      .in("membership_id", membershipIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("burn_membership_notes")
      .select(
        "membership_id, actor_profile_id, note, created_at, special_circumstances",
      )
      .eq("project_id", projectId)
      .in("membership_id", membershipIds)
      .order("created_at", { ascending: true }),
  ]);

  const allTransfers: any[] = transferChainsResult.data || [];
  for (const tr of allTransfers) {
    if (tr.from_email) emailsById[tr.from_owner_id] = tr.from_email;
    if (tr.to_email) emailsById[tr.to_owner_id] = tr.to_email;
  }

  const events = eventsResult.data || [];
  const notes = notesResult.data || [];

  const resolveActor = await buildActorResolver(
    supabase,
    events,
    notes,
    projectId,
    emailsById,
  );
  const walkTransferChain = buildTransferChainWalker(allTransfers, emailsById);
  const eventsByMembership = groupEventsByMembership(events, resolveActor);
  const notesByMembership = groupNotesByMembership(notes, resolveActor);

  return memberships.map((m) => ({
    ...m,
    metadata: {
      children: m.children,
      pets: m.pets,
      camp_name: m.camp_name,
      phone_number: m.phone_number,
      emergency_contact_onsite: m.emergency_contact_onsite,
      emergency_contact_other: m.emergency_contact_other,
      car_registration: m.car_registration,
    },
    profile: { email: emailsById[m.owner_id] },
    transfer_history: walkTransferChain(m.owner_id),
    check_in_events: eventsByMembership[m.id] || [],
    notes: notesByMembership[m.id] || [],
  }));
}
