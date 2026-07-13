import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole } from "@/utils/types";

import * as uuid from "uuid";

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const id = request.nextUrl.pathname.split("/").pop();

    if (!uuid.validate(id)) {
      return NextResponse.json({ error: "Invalid id (should be a UUID)" }, { status: 400 });
    }

    const [foundMembership] = await query(() =>
      supabase
        .from("burn_memberships")
        .select("*")
        .eq("id", id)
        .eq("project_id", project!.id)
    );

    if (!foundMembership) {
      return NextResponse.json({ error: "No member found" }, { status: 404 });
    }

    if (!foundMembership.checked_in_at) {
      const newMetaData = profile?.metadata ?? {};

      if (newMetaData["check_in_count"] === undefined) {
        newMetaData["check_in_count"] = 0;
      }
      newMetaData["check_in_count"] = newMetaData["check_in_count"] + 1;

      await query(() =>
        supabase
          .from("profiles")
          .update({ metadata: newMetaData })
          .eq("id", profile.id)
      );

      await query(() =>
        supabase
          .from("burn_memberships")
          .update({ checked_in_at: new Date() })
          .eq("id", foundMembership.id)
      );

      await query(() =>
        supabase
          .from("burn_membership_checkin_events")
          .insert({
            project_id: project!.id,
            membership_id: foundMembership.id,
            actor_profile_id: profile.id,
            event_type: "check_in",
          })
      );
    }

    const specialNotes = await query(() =>
      supabase
        .from("burn_membership_notes")
        .select("id")
        .eq("membership_id", foundMembership.id)
        .eq("special_circumstances", true)
        .limit(1)
    );

    return {
      id: foundMembership.id,
      first_name: foundMembership.first_name,
      last_name: foundMembership.last_name,
      birthdate: foundMembership.birthdate,
      checked_in_at: foundMembership.checked_in_at,
      has_special_circumstances: specialNotes.length > 0,
      metadata: {
        children: foundMembership.metadata.children,
        pets: foundMembership.metadata.pets,
        car_registration: foundMembership.metadata.car_registration,
      }
    }
  },
  undefined,
  BurnRole.MembershipScanner
);

