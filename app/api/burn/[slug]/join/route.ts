import { requestWithAuth, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole } from "@/utils/types";

export const POST = requestWithAuth(async (supabase, profile, req, body) => {
  const projectSlug = req.nextUrl.pathname.split("/")[3];
  if (profile.projects.find((p) => p.slug === projectSlug)) {
    return NextResponse.json({ error: "Already a member" }, { status: 400 });
  }

  const project = await query(() =>
    supabase.from("projects").select("*").eq("slug", projectSlug).maybeSingle(),
  );

  if (!project) {
    return NextResponse.json(
      {
        error: "You're too early! Check back later! 🕐",
      },
      { status: 404 },
    );
  }

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
});
