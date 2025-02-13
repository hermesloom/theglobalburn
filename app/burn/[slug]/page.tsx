"use client";

import React from "react";
import { useProject } from "@/app/_components/SessionContext";
import Heading from "@/app/_components/Heading";
import { Card, CardBody } from "@nextui-org/react";

export default function ProjectPage() {
  const { project } = useProject();

  const timelineEvents = [
    {
      date: new Date(project?.burn_config.lottery_opens_at!).toLocaleString(),
      title: "Membership lottery signup opens",
    },
    {
      date: new Date(project?.burn_config.lottery_closes_at!).toLocaleString(),
      title: "Lottery is drawn and winners can buy their membership",
    },
    {
      date: new Date(
        project?.burn_config.open_sale_lottery_entrants_only_starting_at!,
      ).toLocaleString(),
      title: "Open sale opens for those who entered the lottery but didn't win",
    },
    {
      date: new Date(
        project?.burn_config.open_sale_general_starting_at!,
      ).toLocaleString(),
      title: "Open sale and transfers open for everyone",
    },
    {
      date: new Date(
        project?.burn_config.last_possible_transfer_at!,
      ).toLocaleString(),
      title: "Open sale and transfers close",
    },
    {
      date: "July 21 – July 27, 2025",
      title: "Burn",
    },
  ];

  return (
    <div>
      <Heading>{project?.name} – Timeline</Heading>

      <div className="space-y-4 mt-6">
        {timelineEvents.map((event, index) => (
          <div key={index} className="relative pl-8">
            {/* Timeline line */}
            {index !== timelineEvents.length - 1 && (
              <div className="absolute left-[0.9375rem] top-11 bottom-[-2rem] w-0.5 bg-gray-200" />
            )}

            {/* Timeline dot */}
            <div className="absolute left-[0.625rem] top-6 w-3 h-3 rounded-full bg-primary-500 border-4 border-white z-10" />

            {/* Timeline event */}
            <Card shadow="sm" className="p-2">
              <CardBody>
                <div>
                  <p className="text-small text-default-500">{event.date}</p>
                  <h3 className="text-lg font-semibold mt-1">{event.title}</h3>
                </div>
              </CardBody>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
