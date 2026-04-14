import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";
import { NextRequest, NextResponse } from "next/server";

const UpdateTimelineEventRequestSchema = s.object({
  title: s.string().optional(),
  body: s.string().optional(),
  date: s.string().optional(),
  date_end: s.string().optional(),
});

// PATCH - Update an existing timeline event (admin required)
export const PATCH = requestWithProject<
  s.infer<typeof UpdateTimelineEventRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const id = request.nextUrl.pathname.split("/").pop();

    // Verify the event exists and belongs to this project
    const existingEvent = await query(() =>
      supabase
        .from("burn_timeline_events")
        .select("*")
        .eq("id", id)
        .eq("project_id", project!.id)
        .single()
    );

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Timeline event not found" },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.body !== undefined) updateData.body = body.body?.trim() || null;
    if (body.date !== undefined) updateData.date = body.date || null;
    if (body.date_end !== undefined) updateData.date_end = body.date_end || null;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;

    const event = await query(() =>
      supabase
        .from("burn_timeline_events")
        .update(updateData)
        .eq("id", id)
        .select()
        .single()
    );

    return event;
  },
  UpdateTimelineEventRequestSchema,
  BurnRole.Admin
);

// DELETE - Delete a timeline event (admin required)
export const DELETE = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const id = request.nextUrl.pathname.split("/").pop();

    // Verify the event exists and belongs to this project
    const existingEvent = await query(() =>
      supabase
        .from("burn_timeline_events")
        .select("*")
        .eq("id", id)
        .eq("project_id", project!.id)
        .single()
    );

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Timeline event not found" },
        { status: 404 }
      );
    }

    await query(() =>
      supabase
        .from("burn_timeline_events")
        .delete()
        .eq("id", id)
    );

    return { success: true };
  },
  undefined,
  BurnRole.Admin
);
