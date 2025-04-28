import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole } from "@/utils/types";

export const DELETE = requestWithProject(
  async (supabase, profile, request, body, project) => {
    // Get the offer ID from the path parameter
    const segments = request.nextUrl.pathname.split("/");
    const offerId = segments[segments.length - 1];

    if (!offerId) {
      return NextResponse.json(
        { error: "Offer ID is required" },
        { status: 400 },
      );
    }

    // Verify the offer belongs to the user
    const existingOffer = await query(() =>
      supabase
        .from("gar_offers")
        .select("*")
        .eq("id", offerId)
        .eq("user_id", profile.id)
        .single(),
    );

    if (!existingOffer) {
      return NextResponse.json(
        { error: "Offer not found or you don't have permission to delete it" },
        { status: 404 },
      );
    }

    // Delete the offer
    await query(() => supabase.from("gar_offers").delete().eq("id", offerId));

    return { success: true };
  },
  undefined,
  BurnRole.Participant,
);
