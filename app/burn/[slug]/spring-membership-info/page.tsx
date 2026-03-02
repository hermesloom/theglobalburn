"use client";

import React from "react";
import Heading from "@/app/_components/Heading";
import { useProject } from "@/app/_components/SessionContext";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function SpringMembershipInfoPage() {
  const { project } = useProject();

  return (
    <>
      <Heading>Spring Membership Sale</Heading>
      <p className="mb-4">
        Are you looking to buy a membership in the Spring Sale?{" "}
        <b>Then you're at the right place!</b>
      </p>
      <p className="mb-4">
        The Spring Membership Sale will operate on a{" "}
        <i>first-come, first-served</i> basis on this platform. It begins on{" "}
        <b>{formatDate(project!.burn_config.open_sale_general_starting_at!)}</b>{" "}
        and runs for one week.
      </p>
      <p className="mb-4">
        The Spring Membership is transferable, should your plans change.
      </p>
    </>
  );
}
