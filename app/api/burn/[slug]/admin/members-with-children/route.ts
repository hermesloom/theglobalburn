import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const memberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select(`first_name, last_name, owner_id, metadata->children`)
        .eq("project_id", project!.id)
    );

    const withChildren = (memberships as any[]).filter(
      (m) => Array.isArray(m.children) && m.children.length > 0
    );

    const ownerIds = withChildren.map((m) => m.owner_id);

    const profiles = ownerIds.length > 0
      ? await query(() =>
          supabase.from("profiles").select("id, email").in("id", ownerIds)
        )
      : [];

    const emailById: Record<string, string> = Object.fromEntries(
      (profiles as any[]).map((p) => [p.id, p.email])
    );

    return {
      data: withChildren.map((m) => ({
        first_name: m.first_name,
        last_name: m.last_name,
        email: emailById[m.owner_id] ?? "",
        children: m.children,
      })),
    };
  },
  undefined,
  BurnRole.MembershipManager
);
