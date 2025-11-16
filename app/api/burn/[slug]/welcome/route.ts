import { requestWithAuth, query } from "@/app/api/_common/endpoints";
import { getProjectBySlug } from "@/app/api/_common/profile";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";

const CreateWelcomeRequestSchema = s.object({
  message: s.string(),
});

// GET - Get a random welcome from the project (BL2026) - accessible to anyone
export const GET = requestWithAuth(async (supabase, profile, request, body) => {
  const projectSlug = request.nextUrl.pathname.split("/")[3];
  const project = await getProjectBySlug(supabase, projectSlug);
  
  if (!project) {
    return { error: "Project not found" };
  }

  const welcomes = await query(() =>
    supabase
      .from("burn_welcome")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
  );

  if (welcomes.length === 0) {
    return { message: null };
  }

  // Get a random welcome
  const randomIndex = Math.floor(Math.random() * welcomes.length);
  const randomWelcome = welcomes[randomIndex];

  return { message: randomWelcome.message };
});

// POST - Create a new welcome (requires project participation, will auto-join if needed)
export const POST = requestWithAuth<
  s.infer<typeof CreateWelcomeRequestSchema>
>(
  async (supabase, profile, request, body) => {
    const projectSlug = request.nextUrl.pathname.split("/")[3];
    let project = await getProjectBySlug(supabase, projectSlug);
    
    if (!project) {
      return { error: "Project not found" };
    }

    // Check if user is part of the project, if not, add them as participant
    const userProject = profile.projects.find((p) => p.slug === projectSlug);
    if (!userProject) {
      const role = await query(() =>
        supabase
          .from("roles")
          .select("*")
          .eq("project_id", project.id)
          .eq("name", BurnRole.Participant)
          .single(),
      );

      await query(() =>
        supabase
          .from("role_assignments")
          .insert({ user_id: profile.id, role_id: role.id }),
      );
    }

    const welcome = await query(() =>
      supabase
        .from("burn_welcome")
        .insert({
          project_id: project.id,
          owner_id: profile.id,
          message: body.message.trim(),
        })
        .select()
        .single()
    );

    return welcome;
  },
  CreateWelcomeRequestSchema,
);

