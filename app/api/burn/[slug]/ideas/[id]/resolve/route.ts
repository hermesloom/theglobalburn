import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";
import { NextResponse } from "next/server";

// PATCH - Toggle resolved status (idea resolver role required)
export const PATCH = requestWithProject(
  async (supabase, profile, request, body, project) => {
    // Path is /api/burn/[slug]/ideas/[id]/resolve, so ID is second-to-last segment
    const pathParts = request.nextUrl.pathname.split("/").filter(Boolean);
    const ideasIndex = pathParts.indexOf("ideas");
    const ideaId = ideasIndex >= 0 && ideasIndex + 1 < pathParts.length 
                   ? pathParts[ideasIndex + 1] 
                   : null;
    
    if (!ideaId) {
      return NextResponse.json({ error: "Invalid idea ID" }, { status: 400 });
    }

    // Verify the idea belongs to this project
    const existingIdea = await query(() =>
      supabase
        .from("burn_ideas")
        .select("project_id, resolved")
        .eq("id", ideaId)
        .single()
    );

    if (!existingIdea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    if (existingIdea.project_id !== project!.id) {
      return NextResponse.json(
        { error: "Idea does not belong to this project" },
        { status: 403 }
      );
    }

    // Toggle resolved status
    const updatedIdea = await query(() =>
      supabase
        .from("burn_ideas")
        .update({ resolved: !existingIdea.resolved })
        .eq("id", ideaId)
        .select()
        .single()
    );

    return updatedIdea;
  },
  undefined,
  BurnRole.IdeaResolver
);

