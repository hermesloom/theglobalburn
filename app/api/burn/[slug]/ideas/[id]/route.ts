import { requestWithMembership, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";

const UpdateIdeaRequestSchema = s.object({
  title: s.string().optional(),
  description: s.string().optional().nullable(),
});

// PATCH - Update an idea (membership required, only own ideas)
export const PATCH = requestWithMembership<
  s.infer<typeof UpdateIdeaRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const ideaId = request.nextUrl.pathname.split("/").pop();

    // Verify the idea belongs to this project and user
    const existingIdea = await query(() =>
      supabase
        .from("burn_ideas")
        .select("project_id, owner_id")
        .eq("id", ideaId)
        .single()
    );

    if (!existingIdea) {
      return new Response(
        JSON.stringify({ error: "Idea not found" }),
        { status: 404 }
      );
    }

    if (existingIdea.project_id !== project!.id) {
      return new Response(
        JSON.stringify({ error: "Idea does not belong to this project" }),
        { status: 403 }
      );
    }

    if (existingIdea.owner_id !== profile.id) {
      return new Response(
        JSON.stringify({ error: "You can only edit your own ideas" }),
        { status: 403 }
      );
    }

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;

    const idea = await query(() =>
      supabase
        .from("burn_ideas")
        .update(updateData)
        .eq("id", ideaId)
        .select()
        .single()
    );

    return idea;
  },
  UpdateIdeaRequestSchema,
);

// DELETE - Delete an idea (membership required, only own ideas)
export const DELETE = requestWithMembership(
  async (supabase, profile, request, body, project) => {
    const ideaId = request.nextUrl.pathname.split("/").pop();

    // Verify the idea belongs to this project and user
    const existingIdea = await query(() =>
      supabase
        .from("burn_ideas")
        .select("project_id, owner_id")
        .eq("id", ideaId)
        .single()
    );

    if (!existingIdea) {
      return new Response(
        JSON.stringify({ error: "Idea not found" }),
        { status: 404 }
      );
    }

    if (existingIdea.project_id !== project!.id) {
      return new Response(
        JSON.stringify({ error: "Idea does not belong to this project" }),
        { status: 403 }
      );
    }

    if (existingIdea.owner_id !== profile.id) {
      return new Response(
        JSON.stringify({ error: "You can only delete your own ideas" }),
        { status: 403 }
      );
    }

    await query(() =>
      supabase
        .from("burn_ideas")
        .delete()
        .eq("id", ideaId)
    );

    return { success: true };
  },
);

