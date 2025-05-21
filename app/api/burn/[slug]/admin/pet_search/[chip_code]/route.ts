import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole, BurnMembership } from "@/utils/types";

import * as uuid from "uuid";

// TODO: Limit to the specific burn (project_id?)
export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const chipCode = request.nextUrl.pathname.split("/").pop();

    let all_memberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select("id, metadata")
        .eq("project_id", project!.id)
    );

    console.log({ beforeids: all_memberships.map(m => m.id) })

    const ids = all_memberships.filter(m =>
      Array.isArray(m.metadata?.pets) &&
      m.metadata.pets.some(pet => pet.chip_code === chipCode)
    ).map(m => m.id)

    let foundMemberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select("*")
        .eq("project_id", project!.id)
        .in("id", ids)
    );

    console.log({ foundMemberships })

    return (
      foundMemberships.map(membership => {
        return {
          id: membership.id,
          first_name: membership.first_name,
          last_name: membership.last_name,
          birthdate: membership.birthdate,
          checked_in_at: membership.checked_in_at,
          metadata: {
            children: membership.metadata.children,
            pets: membership.metadata.pets,
          }
        }
      })
    )
  },
  undefined,
  BurnRole.MembershipScanner
);


