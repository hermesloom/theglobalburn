import { requestWithProject, query } from "@/app/api/_common/endpoints";

// GET - Get all timeline events for a project (public endpoint, no auth required for reading)
export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const events = await query(() =>
      supabase
        .from("burn_timeline_events")
        .select("*")
        .eq("project_id", project!.id)
        .order("date", { ascending: true, nullsFirst: false })
    );

    return { data: events };
  }
);
