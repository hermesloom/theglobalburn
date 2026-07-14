import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";
import s from "ajv-ts";

const NoteSchema = s.object({ note: s.string() });

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    return await query(() =>
      supabase.from("burn_membership_notes").insert({
        project_id: project!.id,
        membership_id: null,
        actor_profile_id: profile.id,
        note: body.note,
      }),
    );
  },
  NoteSchema,
  BurnRole.MembershipManager,
);

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const notes: any[] = await query(() =>
      supabase
        .from("burn_membership_notes")
        .select("id, created_at, membership_id, actor_profile_id, note, special_circumstances")
        .eq("project_id", project!.id)
        .order("created_at", { ascending: false }),
    );

    const actorProfileIds = [...new Set(notes.map((n) => n.actor_profile_id))];
    const membershipIds = [...new Set(notes.map((n) => n.membership_id).filter(Boolean))];

    const [actorMembershipsData, membershipNamesData] = await Promise.all([
      actorProfileIds.length > 0
        ? query(() =>
            supabase
              .from("burn_memberships")
              .select("owner_id, first_name, last_name")
              .eq("project_id", project!.id)
              .in("owner_id", actorProfileIds),
          )
        : [],
      membershipIds.length > 0
        ? query(() =>
            supabase
              .from("burn_memberships")
              .select("id, first_name, last_name")
              .eq("project_id", project!.id)
              .in("id", membershipIds),
          )
        : [],
    ]);

    const resolvedActorIds = new Set((actorMembershipsData as any[]).map((m) => m.owner_id));
    const missingActorIds = actorProfileIds.filter((id) => !resolvedActorIds.has(id));
    const actorEmailsData: any[] =
      missingActorIds.length > 0
        ? await query(() =>
            supabase.from("profiles").select("id, email").in("id", missingActorIds),
          )
        : [];

    const actorNameByProfileId: Record<string, string> = {};
    for (const m of actorMembershipsData as any[])
      actorNameByProfileId[m.owner_id] = `${m.first_name} ${m.last_name}`;
    const emailById: Record<string, string> = {};
    for (const p of actorEmailsData) emailById[p.id] = p.email;

    const membershipNameById: Record<string, string> = {};
    for (const m of membershipNamesData as any[])
      membershipNameById[m.id] = `${m.first_name} ${m.last_name}`;

    return notes.map((n) => ({
      id: n.id,
      created_at: n.created_at,
      membership_id: n.membership_id,
      member_name: n.membership_id ? (membershipNameById[n.membership_id] || n.membership_id) : null,
      actor_name:
        actorNameByProfileId[n.actor_profile_id] ||
        emailById[n.actor_profile_id] ||
        n.actor_profile_id,
      note: n.note,
      special_circumstances: n.special_circumstances ?? false,
    }));
  },
  undefined,
  BurnRole.MembershipManager,
);
