import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole, BurnMembership } from "@/utils/types";

import * as uuid from "uuid";

type Pet = {
  chip_code: string;
};

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const chipCode = request.nextUrl.pathname.split("/").pop();

    let all_memberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select("id, metadata")
        .eq("project_id", project!.id)
    );

    // I know this isn’t ideal, but
    // 1.) there doesn’t seem to be a good way to filter for values inside of arrays in JSONB with the JS supabase API and
    // 2.) this functionality will probably only be used upwards of a few times during the event
    //
    // If it turns out to be a problem, it might be possible to use `ILIKE` to limit the first set of results
    const ids = all_memberships.filter((m: BurnMembership) =>
      Array.isArray(m.metadata?.pets) &&
      m.metadata?.pets.length > 0 &&
      (chipCode == "all hail the jort" ?
        true :
        m.metadata.pets.some((pet: Pet) => pet.chip_code === chipCode)
      )
    ).map((m: BurnMembership) => m.id)

    let foundMemberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select("*")
        .eq("project_id", project!.id)
        .in("id", ids)
    );

    return (
      foundMemberships.map((membership: BurnMembership) => {
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
  BurnRole.ThresholdWatcher
);


