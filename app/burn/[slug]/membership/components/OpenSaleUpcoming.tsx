"use client";

import React from "react";
import { useProject } from "@/app/_components/SessionContext";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function OpenSaleUpcoming() {
  const { project } = useProject();

  return (
    <div className="flex flex-col gap-4">
      <p>
        Are you looking to buy a membership in the Spring Sale?{" "}
        <b>Then you're at the right place!</b>
      </p>
      <p>
        The Spring Membership Sale will operate on a{" "}
        <i>first-come, first-served</i> basis on this platform. It begins{" "}
        <b>{formatDate(project!.burn_config.open_sale_general_starting_at!)}</b>{" "}
        right here and runs for one week.
      </p>
      <p>The Spring Membership is transferable, should your plans change.</p>
    </div>
  );
}
