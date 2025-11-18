"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import { Spinner, Card, CardBody } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";

interface NewsletterItem {
  date: string; // ISO format (YYYY-MM-DD)
  title: string;
  link: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function NewsletterPage() {
  const { project } = useProject();
  const [newsletters, setNewsletters] = useState<NewsletterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNewsletters = async () => {
      try {
        setLoading(true);
        const response = await apiGet(`/burn/${project?.slug}/newsletter`);
        setNewsletters(response.data || []);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load newsletters");
      } finally {
        setLoading(false);
      }
    };

    if (project?.slug) {
      fetchNewsletters();
    }
  }, [project?.slug]);

  if (loading) {
    return (
      <>
        <Heading>Newsletter</Heading>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Heading>Newsletter</Heading>
        <div className="text-red-500">Error: {error}</div>
      </>
    );
  }

  if (newsletters.length === 0) {
    return (
      <>
        <Heading>Newsletter</Heading>
        <div className="text-gray-500">No newsletters available.</div>
      </>
    );
  }

  return (
    <>
      <Heading>Newsletter</Heading>
      <div className="flex flex-col gap-2">
        {newsletters.map((newsletter, index) => (
          <Card
            key={index}
            className="border border-default-200"
            style={{
              boxShadow: "none",
              transition: "all 300ms ease-in-out",
            }}
            isPressable
            as="a"
            href={newsletter.link}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow =
                "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <CardBody className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-default-500 mb-1.5 font-medium">
                    {formatDate(newsletter.date)}
                  </div>
                  <div className="text-sm font-medium text-default-900 line-clamp-2">
                    {newsletter.title}
                  </div>
                </div>
                <div className="flex-shrink-0 text-default-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
