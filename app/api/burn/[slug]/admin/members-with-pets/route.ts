import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole, BurnMembership } from "@/utils/types";

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const allMemberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select("first_name, last_name, owner_id, metadata")
        .eq("project_id", project!.id)
    );

    const withPets = (allMemberships as any[]).filter(
      (m) => Array.isArray(m.metadata?.pets) && m.metadata.pets.length > 0
    );

    const ownerIds = withPets.map((m) => m.owner_id);

    const profiles =
      ownerIds.length > 0
        ? await query(() =>
            supabase.from("profiles").select("id, email").in("id", ownerIds)
          )
        : [];

    const emailById: Record<string, string> = Object.fromEntries(
      (profiles as any[]).map((p) => [p.id, p.email])
    );

    return {
      data: withPets.map((m) => ({
        first_name: m.first_name,
        last_name: m.last_name,
        email: emailById[m.owner_id] ?? "",
        pets: m.metadata.pets,
      })),
    };
  },
  undefined,
  BurnRole.MembershipManager
);
