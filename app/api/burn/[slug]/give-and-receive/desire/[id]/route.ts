import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole } from "@/utils/types";

export const DELETE = requestWithProject(
  async (supabase, profile, request, body, project) => {
    // Get the desire ID from the path parameter
    const segments = request.nextUrl.pathname.split("/");
    const desireId = segments[segments.length - 1];

    if (!desireId) {
      return NextResponse.json(
        { error: "Desire ID is required" },
        { status: 400 },
      );
    }

    // Verify the desire belongs to the user
    const existingDesire = await query(() =>
      supabase
        .from("gar_desires")
        .select("*")
        .eq("id", desireId)
        .eq("user_id", profile.id)
        .single(),
    );

    if (!existingDesire) {
      return NextResponse.json(
        { error: "Desire not found or you don't have permission to delete it" },
        { status: 404 },
      );
    }

    // Delete the desire
    await query(() => supabase.from("gar_desires").delete().eq("id", desireId));

    return { success: true };
  },
  undefined,
  BurnRole.Participant,
);
