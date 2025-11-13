import { requestWithProject, requestWithMembership, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";

const CreateLinkRequestSchema = s.object({
  label: s.string(),
  url: s.string(),
  emoji: s.string().optional(),
  display_order: s.number().optional(),
});

// GET - Get all links for a project (requires project access, but not membership)
export const GET = requestWithProject(async (supabase, profile, request, body, project) => {
  const links = await query(() =>
    supabase
      .from("burn_links")
      .select("*")
      .eq("project_id", project!.id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
  );
  return { data: links };
});

// POST - Create a new link (membership required)
export const POST = requestWithMembership<
  s.infer<typeof CreateLinkRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    // Get the max display_order for this project
    const existingLinks = await query(() =>
      supabase
        .from("burn_links")
        .select("display_order")
        .eq("project_id", project!.id)
        .order("display_order", { ascending: false })
        .limit(1)
    );

    const maxOrder = existingLinks.length > 0 && existingLinks[0].display_order !== null
      ? existingLinks[0].display_order
      : -1;

    const link = await query(() =>
      supabase
        .from("burn_links")
        .insert({
          project_id: project!.id,
          label: body.label,
          url: body.url,
          emoji: body.emoji || null,
          display_order: body.display_order ?? maxOrder + 1,
        })
        .select()
        .single()
    );

    return link;
  },
  CreateLinkRequestSchema,
);

