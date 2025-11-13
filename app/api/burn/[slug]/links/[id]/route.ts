import { requestWithMembership, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";

const UpdateLinkRequestSchema = s.object({
  label: s.string().optional(),
  url: s.string().optional(),
  emoji: s.string().optional().nullable(),
  display_order: s.number().optional(),
});

// PATCH - Update a link (membership required)
export const PATCH = requestWithMembership<
  s.infer<typeof UpdateLinkRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const linkId = request.nextUrl.pathname.split("/").pop();

    // Verify the link belongs to this project
    const existingLink = await query(() =>
      supabase
        .from("burn_links")
        .select("project_id")
        .eq("id", linkId)
        .single()
    );

    if (!existingLink || existingLink.project_id !== project!.id) {
      return new Response(
        JSON.stringify({ error: "Link not found" }),
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (body.label !== undefined) updateData.label = body.label;
    if (body.url !== undefined) updateData.url = body.url;
    if (body.emoji !== undefined) updateData.emoji = body.emoji;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;

    const link = await query(() =>
      supabase
        .from("burn_links")
        .update(updateData)
        .eq("id", linkId)
        .select()
        .single()
    );

    return link;
  },
  UpdateLinkRequestSchema,
);

// DELETE - Delete a link (membership required)
export const DELETE = requestWithMembership(
  async (supabase, profile, request, body, project) => {
    const linkId = request.nextUrl.pathname.split("/").pop();

    // Verify the link belongs to this project
    const existingLink = await query(() =>
      supabase
        .from("burn_links")
        .select("project_id")
        .eq("id", linkId)
        .single()
    );

    if (!existingLink || existingLink.project_id !== project!.id) {
      return new Response(
        JSON.stringify({ error: "Link not found" }),
        { status: 404 }
      );
    }

    await query(() =>
      supabase
        .from("burn_links")
        .delete()
        .eq("id", linkId)
    );

    return { success: true };
  },
);

