import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";

const CreateTimelineEventRequestSchema = s.object({
  title: s.string(),
  body: s.string().optional(),
  date: s.string().optional(),
  date_end: s.string().optional(),
});

// GET - Get all timeline events for a project, sorted by date
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
  },
  undefined,
  BurnRole.Admin
);

// POST - Create a new timeline event (admin required)
export const POST = requestWithProject<
  s.infer<typeof CreateTimelineEventRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const event = await query(() =>
      supabase
        .from("burn_timeline_events")
        .insert({
          project_id: project!.id,
          title: body.title.trim(),
          body: body.body?.trim() || null,
          date: body.date || null,
          date_end: body.date_end || null,
        })
        .select()
        .single()
    );

    return event;
  },
  CreateTimelineEventRequestSchema,
  BurnRole.Admin
);
