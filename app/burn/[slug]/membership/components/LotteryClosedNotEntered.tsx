"use client";

import React from "react";
import { useProject } from "@/app/_components/SessionContext";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function LotteryClosedNotEntered() {
  const { project } = useProject();

  return (
    <p>
      The lottery is closed and you did not enter it. You will still be able to
      purchase a membership in the open sale for the general public, which will
      start on{" "}
      <b>{formatDate(project?.burn_config.open_sale_general_starting_at!)}</b>.
      It will happen right here on this platform as well.
    </p>
  );
}
