import { requestWithMembership, query } from "@/app/api/_common/endpoints";

// POST - Vote for an idea (membership required)
export const POST = requestWithMembership(
  async (supabase, profile, request, body, project) => {
    // Path is /api/burn/[slug]/ideas/[id]/vote, so ID is second-to-last segment
    const pathParts = request.nextUrl.pathname.split("/").filter(Boolean);
    const ideasIndex = pathParts.indexOf("ideas");
    const ideaId = ideasIndex >= 0 && ideasIndex + 1 < pathParts.length 
                   ? pathParts[ideasIndex + 1] 
                   : null;
    
    if (!ideaId) {
      return new Response(
        JSON.stringify({ error: "Invalid idea ID" }),
        { status: 400 }
      );
    }

    // Verify the idea belongs to this project
    const existingIdea = await query(() =>
      supabase
        .from("burn_ideas")
        .select("project_id")
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

    // Check if vote already exists
    const existingVote = await query(() =>
      supabase
        .from("burn_idea_votes")
        .select("id")
        .eq("idea_id", ideaId)
        .eq("owner_id", profile.id)
        .maybeSingle()
    );

    if (existingVote) {
      return {
        message: "Already voted",
        voted: true,
      };
    }

    const vote = await query(() =>
      supabase
        .from("burn_idea_votes")
        .insert({
          idea_id: ideaId,
          owner_id: profile.id,
        })
        .select()
        .single()
    );

    return vote;
  },
);

// DELETE - Remove vote for an idea (membership required)
export const DELETE = requestWithMembership(
  async (supabase, profile, request, body, project) => {
    // Path is /api/burn/[slug]/ideas/[id]/vote, so ID is second-to-last segment
    const pathParts = request.nextUrl.pathname.split("/").filter(Boolean);
    const ideasIndex = pathParts.indexOf("ideas");
    const ideaId = ideasIndex >= 0 && ideasIndex + 1 < pathParts.length 
                   ? pathParts[ideasIndex + 1] 
                   : null;
    
    if (!ideaId) {
      return new Response(
        JSON.stringify({ error: "Invalid idea ID" }),
        { status: 400 }
      );
    }

    // Verify the idea belongs to this project
    const existingIdea = await query(() =>
      supabase
        .from("burn_ideas")
        .select("project_id")
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

    const result = await query(() =>
      supabase
        .from("burn_idea_votes")
        .delete()
        .eq("idea_id", ideaId)
        .eq("owner_id", profile.id)
        .select()
    );

    return {
      success: true,
      deleted: result && Array.isArray(result) && result.length > 0,
    };
  },
);

