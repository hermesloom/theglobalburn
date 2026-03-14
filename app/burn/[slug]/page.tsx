"use client";

import React, { useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import Heading from "@/app/_components/Heading";
import { Card, CardBody, Link, Button } from "@nextui-org/react";
import { formatDate, formatDateRange } from "@/app/burn/[slug]/membership/components/helpers/date";

interface TimelineEvent {
  date: Date | null;
  dateEnd?: Date | null;
  title: string;
  body?: React.ReactNode;
}

export default function ProjectPage() {
  const { project } = useProject();
  const [showEarlierEvents, setShowEarlierEvents] = useState(false);

  const timelineEvents: TimelineEvent[] =
    project?.slug === "the-borderland-2025"
      ? [
          {
            date: project?.burn_config.lottery_opens_at
              ? new Date(project.burn_config.lottery_opens_at)
              : null,
            title: "Membership lottery signup opens",
          },
          {
            date: project?.burn_config.lottery_closes_at
              ? new Date(project.burn_config.lottery_closes_at)
              : null,
            title: "Lottery is drawn and winners can buy their membership",
          },
          {
            date: project?.burn_config.open_sale_lottery_entrants_only_starting_at
              ? new Date(
                  project.burn_config.open_sale_lottery_entrants_only_starting_at,
                )
              : null,
            title:
              "Open sale opens for those who entered the lottery but didn't win",
          },
          {
            date: project?.burn_config.open_sale_general_starting_at
              ? new Date(project.burn_config.open_sale_general_starting_at)
              : null,
            title: "Open sale and transfers open for everyone",
          },
          {
            date: project?.burn_config.last_possible_transfer_at
              ? new Date(project.burn_config.last_possible_transfer_at)
              : null,
            title: "Open sale and transfers close",
          },
          {
            date: new Date("2025-07-21"),
            dateEnd: new Date("2025-07-27"),
            title: "Burn",
          },
        ]
      : [
          {
            date: project?.burn_config.open_sale_non_transferable_starting_at
              ? new Date(
                  project.burn_config.open_sale_non_transferable_starting_at,
                )
              : null,
            title: "Fall Membership Sale opens",
          },
          {
            date: project?.burn_config.open_sale_non_transferable_ending_at
              ? new Date(
                  project.burn_config.open_sale_non_transferable_ending_at,
                )
              : null,
            title: "Fall Membership Sale closes",
          },
          {
            date: new Date("2025-11-24T19:00:00Z"),
            title: "Annual General Meeting",
            body: (
              <Link
                isExternal
                href="https://talk.theborderland.se/d/Xh7k8Lov/annual-general-meeting-november-24-2025-at-20-00-8pm-"
              >
                See here for more info
              </Link>
            ),
          },
          {
            date: project?.burn_config.open_sale_general_starting_at
              ? new Date(project.burn_config.open_sale_general_starting_at)
              : null,
            title: "Spring Membership Sale opens",
          },
          {
            date: new Date("2026-03-17T16:00:00Z"),
            title: "Spring Membership Sale closes",
          },
          {
            date: new Date("2026-06-22T21:59:59Z"),
            title: "Spring Membership transfers close (full refund)",
          },
          {
            date: project?.burn_config.last_possible_transfer_at
              ? new Date(project.burn_config.last_possible_transfer_at)
              : null,
            title: "Spring Membership transfers close (partial refund)",
          },
          {
            date: new Date("2026-07-20"),
            dateEnd: new Date("2026-07-26"),
            title: "Burn",
          },
        ];

  // Sort events by date (chronological order)
  // Events with null dates (TBD) are treated as UNIX epoch (timestamp 0)
  timelineEvents.sort((a, b) => {
    const aTime = a.date?.getTime() ?? 0;
    const bTime = b.date?.getTime() ?? 0;
    return aTime - bTime;
  });

  // Find the index where we should insert the separator (between past and future)
  const now = new Date();
  let separatorIndex = -1;

  for (let i = 0; i < timelineEvents.length; i++) {
    const event = timelineEvents[i];
    // For date ranges, use the end date; otherwise use the start date
    // Null dates are treated as timestamp 0 (UNIX epoch)
    const eventTime = (event.dateEnd || event.date)?.getTime() ?? 0;

    // If this event is in the future and we haven't set separator yet
    if (eventTime > now.getTime() && separatorIndex === -1) {
      separatorIndex = i;
      break;
    }
  }

  // Determine which events to hide by default
  // We want to show the most recent past event (separatorIndex - 1)
  // and hide all events before that (0 to separatorIndex - 2)
  const mostRecentPastEventIndex = separatorIndex > 0 ? separatorIndex - 1 : -1;
  const hasEarlierEvents = separatorIndex > 1;

  return (
    <>
      <Heading>{project?.name} – Timeline</Heading>

      <div className="space-y-4 mt-6">
        {/* Show/Hide earlier events toggle button */}
        {hasEarlierEvents && (
          <div className="flex justify-center mb-4">
            <Button
              variant="light"
              color="primary"
              onPress={() => setShowEarlierEvents(!showEarlierEvents)}
            >
              {showEarlierEvents ? "HIDE EARLIER EVENTS" : "SHOW EARLIER EVENTS"}
            </Button>
          </div>
        )}

        {timelineEvents.map((event, index) => {
          // Determine if this event should be hidden
          const isEarlierEvent = index < mostRecentPastEventIndex;
          const shouldHideEvent = isEarlierEvent && !showEarlierEvents;

          // Skip rendering if event should be hidden
          if (shouldHideEvent) return null;

          return (
          <React.Fragment key={index}>
            {/* Show separator between past and future events */}
            {index === separatorIndex && (
              <div className="relative py-4">
                <div className="absolute left-0 right-0 flex items-center">
                  <div className="flex-grow border-t-2 border-primary-500"></div>
                  <span className="px-4 text-small font-semibold text-primary-500">
                    NOW
                  </span>
                  <div className="flex-grow border-t-2 border-primary-500"></div>
                </div>
              </div>
            )}

            <div className="relative pl-8">
            {/* Timeline line */}
            {index !== timelineEvents.length - 1 && (
              <div
                className={`absolute left-[0.9375rem] top-11 bottom-[-2rem] w-0.5 ${
                  index >= separatorIndex && separatorIndex !== -1
                    ? "bg-primary-500"
                    : "bg-gray-200"
                }`}
              />
            )}

            {/* Timeline dot */}
            <div
              className={`absolute left-[0.625rem] top-6 w-3 h-3 rounded-full border-4 border-white z-10 ${
                index >= separatorIndex && separatorIndex !== -1
                  ? "bg-primary-500"
                  : "bg-gray-400"
              }`}
            />

            {/* Timeline event */}
            <Card shadow="sm" className="p-2">
              <CardBody>
                <div>
                  <p className="text-small text-default-500">
                    {event.date === null
                      ? "TBD"
                      : event.dateEnd
                        ? formatDateRange(event.date, event.dateEnd)
                        : formatDate(event.date)}
                  </p>
                  <h3 className="text-lg font-semibold mt-1">{event.title}</h3>
                  {event.body && <div className="mt-2">{event.body}</div>}
                </div>
              </CardBody>
            </Card>
            </div>
          </React.Fragment>
          );
        })}
      </div>
    </>
  );
}
