import { requestWithProject, query } from "@/app/api/_common/endpoints";

// GET - Check if user has applied for low income support
export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const application = await query(() =>
      supabase
        .from("burn_low_income_applications")
        .select("id")
        .eq("project_id", project!.id)
        .eq("owner_id", profile.id)
        .maybeSingle(),
    );

    return {
      hasApplied: !!application,
    };
  },
);

// POST - Submit low income application
export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const existing = await query(() =>
      supabase
        .from("burn_low_income_applications")
        .select("id")
        .eq("project_id", project!.id)
        .eq("owner_id", profile.id)
        .maybeSingle(),
    );

    if (existing) {
      return {
        id: existing.id,
        message: "Already applied",
      };
    }

    if (+new Date() >= +new Date(project!.burn_config.open_sale_general_starting_at!)) {
      throw new Error(
        "Applications for low income support have closed. The Spring Membership Sale has already started.",
      );
    }

    const application = await query(() =>
      supabase
        .from("burn_low_income_applications")
        .insert({
          project_id: project!.id,
          owner_id: profile.id,
        })
        .select()
        .single(),
    );

    return application;
  },
);

// DELETE - Opt out of low income application
export const DELETE = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const result = await query(() =>
      supabase
        .from("burn_low_income_applications")
        .delete()
        .eq("project_id", project!.id)
        .eq("owner_id", profile.id)
        .select(),
    );

    return {
      success: true,
      deleted: result && Array.isArray(result) && result.length > 0,
    };
  },
);
