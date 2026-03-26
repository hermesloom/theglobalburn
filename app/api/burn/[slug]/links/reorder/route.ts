import { requestWithMembership, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";

const ReorderLinksRequestSchema = s.object({
  linkIds: s.array(s.string()),
});

// POST - Reorder links (membership required)
export const POST = requestWithMembership<
  s.infer<typeof ReorderLinksRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const { linkIds } = body;

    // Verify all links belong to this project
    const existingLinks = await query(() =>
      supabase
        .from("burn_links")
        .select("id, project_id")
        .eq("project_id", project!.id)
    );

    const existingLinkIds = new Set(existingLinks.map((link: { id: string }) => link.id));
    const invalidLinkIds = linkIds.filter(id => !existingLinkIds.has(id));

    if (invalidLinkIds.length > 0) {
      return new Response(
        JSON.stringify({ error: "Some link IDs do not belong to this project" }),
        { status: 400 }
      );
    }

    // Update display_order for all links in a single transaction
    // We'll do this by updating each link individually since Supabase doesn't support
    // batch updates with different values easily
    const updates = linkIds.map(async (linkId, index) => {
      return query(() =>
        supabase
          .from("burn_links")
          .update({ display_order: index })
          .eq("id", linkId)
          .eq("project_id", project!.id)
      );
    });

    await Promise.all(updates);

    // Return updated links
    const updatedLinks = await query(() =>
      supabase
        .from("burn_links")
        .select("*")
        .eq("project_id", project!.id)
        .order("display_order", { ascending: true })
    );

    return { data: updatedLinks };
  },
  ReorderLinksRequestSchema,
);
