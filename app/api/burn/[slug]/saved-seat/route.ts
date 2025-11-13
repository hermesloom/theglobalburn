import { requestWithProject, query } from "@/app/api/_common/endpoints";

// GET - Check if user has a saved seat for this project and get total count
export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const savedSeat = await query(() =>
      supabase
        .from("burn_saved_seats")
        .select("id")
        .eq("project_id", project!.id)
        .eq("owner_id", profile.id)
        .maybeSingle(),
    );

    const { count } = await supabase
      .from("burn_saved_seats")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project!.id);

    return {
      hasSavedSeat: !!savedSeat,
      totalCount: count || 0,
    };
  },
);

// POST - Save a seat for the user
export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    // Check if seat already exists
    const existingSeat = await query(() =>
      supabase
        .from("burn_saved_seats")
        .select("id")
        .eq("project_id", project!.id)
        .eq("owner_id", profile.id)
        .maybeSingle(),
    );

    if (existingSeat) {
      return {
        id: existingSeat.id,
        message: "Seat already saved",
      };
    }

    const savedSeat = await query(() =>
      supabase
        .from("burn_saved_seats")
        .insert({
          project_id: project!.id,
          owner_id: profile.id,
        })
        .select()
        .single(),
    );

    return savedSeat;
  },
);

// DELETE - Unsave a seat for the user
export const DELETE = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const result = await query(() =>
      supabase
        .from("burn_saved_seats")
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
