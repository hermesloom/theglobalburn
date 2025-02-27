"use client";

import React from "react";
import MemberDetailsWithHeading from "./helpers/MemberDetailsWithHeading";
import { useProject } from "@/app/_components/SessionContext";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function LotteryClosedNotWinner() {
  const { project } = useProject();

  return (
    <>
      <div className="flex flex-col gap-4">
        Unfortunately you did not win in the lottery, but you will be able to
        purchase a membership in the open sale for lottery entrants, which will
        start on{" "}
        {formatDate(
          project?.burn_config.open_sale_lottery_entrants_only_starting_at!,
        )}
        .
      </div>
      <MemberDetailsWithHeading data={project?.lottery_ticket!} />
    </>
  );
}
