"use client";

import React, { useState, useEffect } from "react";
import { useProject } from "@/app/_components/SessionContext";
import Heading from "@/app/_components/Heading";
import { Card, CardBody, Button } from "@nextui-org/react";
import { formatDate, formatDateRange } from "@/app/burn/[slug]/membership/components/helpers/date";
import { apiGet } from "@/app/_components/api";
import { BurnTimelineEvent, BurnRole } from "@/utils/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";

interface TimelineEvent {
  date: Date | null;
  dateEnd?: Date | null;
  title: string;
  body?: React.ReactNode;
}

export default function ProjectPage() {
  const { project } = useProject();
  const router = useRouter();
  const [showEarlierEvents, setShowEarlierEvents] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = project?.roles.includes(BurnRole.Admin) ?? false;

  useEffect(() => {
    const fetchTimelineEvents = async () => {
      try {
        setIsLoading(true);

        // Generate events from burn_config
        const configEvents = generateConfigEvents();

        // Fetch events from database
        let dbEvents: TimelineEvent[] = [];
        try {
          const response = await apiGet(`/burn/${project?.slug}/timeline-events`, undefined, { hideToast: true });
          const rawDbEvents: BurnTimelineEvent[] = response.data;

          // Convert database events to TimelineEvent format
          dbEvents = rawDbEvents.map((event) => ({
            date: event.date ? new Date(event.date) : null,
            dateEnd: event.date_end ? new Date(event.date_end) : null,
            title: event.title,
            body: event.body ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {event.body}
                </ReactMarkdown>
              </div>
            ) : undefined,
          }));
        } catch (error) {
          // If fetching from DB fails, just use config events
          console.error("Failed to fetch timeline events from database:", error);
        }

        // Merge config and database events
        setTimelineEvents([...configEvents, ...dbEvents]);
      } finally {
        setIsLoading(false);
      }
    };

    if (project?.slug) {
      fetchTimelineEvents();
    }
  }, [project?.slug, project?.burn_config]);

  const createConfigEvent = (dateString: string | undefined, title: string): TimelineEvent | undefined => {
    if (!dateString) return undefined;
    return {
      date: new Date(dateString),
      title,
    };
  };

  const generateConfigEvents = (): TimelineEvent[] => {
    if (!project?.burn_config) return [];

    const config = project.burn_config;

    return [
      createConfigEvent(config.lottery_opens_at, "Membership lottery signup opens"),
      createConfigEvent(config.lottery_closes_at, "Lottery is drawn and winners can buy their membership"),
      createConfigEvent(config.open_sale_lottery_entrants_only_starting_at, "Open sale opens for those who entered the lottery but didn't win"),
      createConfigEvent(config.open_sale_general_starting_at, "Open sale and transfers open for everyone"),
      createConfigEvent(config.open_sale_non_transferable_starting_at, "Fall Membership Sale opens"),
      createConfigEvent(config.open_sale_non_transferable_ending_at, "Fall Membership Sale closes"),
      createConfigEvent(config.last_possible_transfer_at, "Open sale and transfers close"),
    ].filter((event): event is TimelineEvent => event !== undefined);
  };

  // Sort events by date (chronological order)
  // Events with null dates (TBD) are treated as UNIX epoch (timestamp 0)
  const sortedEvents = [...timelineEvents].sort((a, b) => {
    const aTime = a.date?.getTime() ?? 0;
    const bTime = b.date?.getTime() ?? 0;
    return aTime - bTime;
  });

  // Find the index where we should insert the separator (between past and future)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let separatorIndex = -1;

  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
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
  const hasEarlierEvents = sortedEvents.some((event, index) => {
    const eventTime = (event.dateEnd || event.date)?.getTime() ?? 0;
    return eventTime < sevenDaysAgo.getTime() && index < separatorIndex;
  });

  if (isLoading) {
    return (
      <>
        <Heading>{project?.name} – Timeline</Heading>

        {isAdmin && (
          <div className="mt-4">
            <Button
              color="primary"
              variant="flat"
              onPress={() => router.push(`/burn/${project?.slug}/admin/timeline-events`)}
            >
              Manage Timeline Events
            </Button>
          </div>
        )}

        <div className="mt-6 text-center">Loading timeline...</div>
      </>
    );
  }

  return (
    <>
      <Heading>{project?.name} – Timeline</Heading>

      {isAdmin && (
        <div className="mt-4">
          <Button
            color="primary"
            variant="flat"
            onPress={() => router.push(`/burn/${project?.slug}/admin/timeline-events`)}
          >
            Manage Timeline Events
          </Button>
        </div>
      )}

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

        {sortedEvents.length === 0 ? (
          <div className="text-center text-default-500">
            No timeline events available yet.
          </div>
        ) : (
          sortedEvents.map((event, index) => {
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
                  {index !== sortedEvents.length - 1 && (
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
          })
        )}
      </div>
    </>
  );
}
