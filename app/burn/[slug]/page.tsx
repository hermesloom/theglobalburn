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
          date: new Date("2026-03-12"),
          title: "💭 Dreams platform opens",
          body: (
            <p>
              Submit your dreams to the{" "}
              <Link
                isExternal
                href="https://dreams.theborderland.se/borderland/dreams-2026"
              >
                Dreams Platform
              </Link>
              .
            </p>
          ),
        },
        {
          date: new Date("2026-03-16T18:00:00Z"),
          title: "📞 Community Gathering Call",
          body: (
            <>
              <p>
                Whether this is your first Borderland or your tenth, whether
                you&apos;re a wide-eyed newcomer or a grizzled veteran with
                dirt still in your boots — this Monday we&apos;re gathering
                the community for a face-to-face call. Let&apos;s remember
                how to Borderland together and share the most useful tips
                with newcomers. 🫶
              </p>
              <p className="mt-2">
                See you there — bring your questions, your excitement, and
                maybe a snack.
              </p>
              <p className="mt-2">
                Please register below – it&apos;s very important for us to
                know how many virtual pancakes we need to bake for y&apos;all!
              </p>
              <Link
                isExternal
                href="https://zoom.us/meeting/register/bEqD1VEtSnKjE9CYtGrJFg#/registration"
                className="mt-2"
              >
                Register for the call
              </Link>
            </>
          ),
        },
        {
          date: new Date("2026-03-17T16:00:00Z"),
          title: "Spring Membership Sale closes",
        },
        {
          date: new Date("2026-04-07T17:00:00Z"),
          title: "🗺️ Pre-placement kick-off meeting",
          body: (
            <>
              <p>
                Pre placement is meant for large camps with special placement
                needs, sound camps, artworks and infrastructure realities.
              </p>
              <p className="mt-2">
                <strong>BUT:</strong> Pre-placement allows regular camps ONLY
                IF you actively contribute during these four weeks to forming
                a neighborhood, with extra emphasis on being active. (Regular
                camps ~ 25 members)
              </p>
              <p className="mt-2">
                Pre-placement is not meant as a shortcut to find a camp spot
                prior to the General placement phase, but as an option for
                camp placement leads to collaborate around creating a
                neighborhood.
              </p>
              <p className="mt-2">
                If you&apos;re a regular camp and you&apos;re not active, we
                will remove you from pre-placement.
              </p>
              <Link
                isExternal
                href="https://forms.gle/mvjHz99bbNgHTzcL6"
                className="mt-2"
              >
                Sign up for Pre-Placement (BL 2026)
              </Link>
            </>
          ),
        },
        {
          date: new Date("2026-04-12"),
          title: "💭 Deadline for uploading dreams to the platform",
          body: (
            <p>
              Before the deadline, submit your dreams to the{" "}
              <Link
                isExternal
                href="https://dreams.theborderland.se/borderland/dreams-2026"
              >
                Dreams Platform
              </Link>
              .
            </p>
          ),
        },
        {
          date: new Date("2026-04-13"),
          dateEnd: new Date("2026-04-14"),
          title: "💭 Dreamers can edit their dreams",
          body: (
            <>
              <p>
                Dreamers can edit their dreams themselves, merge dreams, adjust
                budgets etc:{" "}
                <Link
                  isExternal
                  href="https://dreams.theborderland.se/borderland/dreams-2026"
                >
                  Dreams Platform
                </Link>
              </p>
            </>
          ),
        },
        {
          date: new Date("2026-04-19"),
          dateEnd: new Date("2026-04-23"),
          title: "💭 Dreams Committee work",
        },
        {
          date: new Date("2026-04-23"),
          dateEnd: new Date("2026-04-26"),
          title: "💭 First round of funding",
        },
        {
          date: new Date("2026-04-29"),
          dateEnd: new Date("2026-05-02"),
          title: "💭 Second round of funding",
        },
        {
          date: new Date("2026-05-05"),
          dateEnd: new Date("2026-05-07"),
          title: "💭 Third round of funding",
        },
        {
          date: new Date("2026-05-07"),
          dateEnd: new Date("2026-05-14"),
          title: "💭 Dreams Committee work",
        },
        {
          date: new Date("2026-05-15"),
          dateEnd: new Date("2026-07-05"),
          title: "💭 First round of uploads for reimbursements",
        },
        {
          date: new Date("2026-05-22"),
          title: "🗺️ General placement opens",
        },
        {
          date: new Date("2026-06-15"),
          title: "🔌 Deadline for members to have their power-need figured out."
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
          date: new Date("2026-07-01"),
          title: "🔌 Last call for camp power setup changes"
        },
        {
          date: new Date("2026-07-20"),
          dateEnd: new Date("2026-07-26"),
          title: "Burn",
        },
        {
          date: new Date("2026-08-03"),
          dateEnd: new Date("2026-08-23"),
          title: "💭 Second round of uploads for reimbursements",
        },
        {
          date: new Date("2026-08-23"),
          dateEnd: new Date("2026-09-11"),
          title: "💭 Final expense approvals and payouts",
        },
        {
          date: new Date("2026-09-11"),
          dateEnd: new Date("2026-09-15"),
          title: "💭 Committee work for unforeseen expenses",
          body: (
            <p>
              Committee work for unforeseen expenses IF there is a surplus.
            </p>
          ),
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
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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
  // We want to show events from the last 7 days
  // and hide all events older than that
  const hasEarlierEvents = timelineEvents.some((event, index) => {
    const eventTime = (event.dateEnd || event.date)?.getTime() ?? 0;
    return eventTime < sevenDaysAgo.getTime() && index < separatorIndex;
  });

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
              {showEarlierEvents ? "HIDE EVENTS OLDER THAN 1 WEEK" : "SHOW EVENTS OLDER THAN 1 WEEK"}
            </Button>
          </div>
        )}

        {timelineEvents.map((event, index) => {
          // Determine if this event should be hidden
          // Hide events that are older than 7 days and in the past
          const eventTime = (event.dateEnd || event.date)?.getTime() ?? 0;
          const isOlderThanSevenDays = eventTime < sevenDaysAgo.getTime();
          const isPastEvent = index < separatorIndex;
          const shouldHideEvent = isOlderThanSevenDays && isPastEvent && !showEarlierEvents;

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
                    className={`absolute left-[0.9375rem] top-11 bottom-[-2rem] w-0.5 ${index >= separatorIndex && separatorIndex !== -1
                      ? "bg-primary-500"
                      : "bg-gray-200"
                      }`}
                  />
                )}

                {/* Timeline dot */}
                <div
                  className={`absolute left-[0.625rem] top-6 w-3 h-3 rounded-full border-4 border-white z-10 ${index >= separatorIndex && separatorIndex !== -1
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
                          : (() => {
                              const formattedDate = event.dateEnd
                                ? formatDateRange(event.date, event.dateEnd)
                                : formatDate(event.date);

                              // Check if event is in the future and within next month
                              const isFutureEvent = index >= separatorIndex && separatorIndex !== -1;
                              const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                              const eventStartTime = event.date?.getTime() ?? 0;
                              const isWithinNextMonth = eventStartTime <= oneMonthFromNow.getTime();

                              if (isFutureEvent && isWithinNextMonth && event.date) {
                                const daysUntil = Math.ceil((eventStartTime - now.getTime()) / (24 * 60 * 60 * 1000));
                                return (
                                  <>
                                    {formattedDate} <strong>({daysUntil} {daysUntil === 1 ? 'day' : 'days'} from now)</strong>
                                  </>
                                );
                              }

                              return formattedDate;
                            })()}
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
