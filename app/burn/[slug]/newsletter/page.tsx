"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet, apiPost } from "@/app/_components/api";
import { Spinner, Card, CardBody, Button } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";
import toast from "react-hot-toast";

interface NewsletterItem {
  date: string; // ISO format (YYYY-MM-DD)
  title: string;
  link: string;
}

interface SubscriptionStatus {
  subscribed: boolean;
  status: string;
  email_address: string;
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
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionActionLoading, setSubscriptionActionLoading] =
    useState(false);

  // Fetch subscription status
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!project?.slug) return;

      try {
        setSubscriptionLoading(true);
        const response = await apiGet(
          `/burn/${project.slug}/newsletter/subscription`,
          undefined,
          { hideToast: true },
        );
        setSubscriptionStatus(response);
      } catch (err: any) {
        // If unauthorized, user is not logged in - that's okay
        if (err.httpStatus !== 403) {
          console.error("Error fetching subscription status:", err);
        }
      } finally {
        setSubscriptionLoading(false);
      }
    };

    fetchSubscriptionStatus();
  }, [project?.slug]);

  // Fetch newsletter archive
  useEffect(() => {
    const fetchNewsletters = async () => {
      if (!project?.slug) return;

      try {
        setLoading(true);
        const response = await apiGet(`/burn/${project.slug}/newsletter`);
        setNewsletters(response.data || []);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load newsletters");
      } finally {
        setLoading(false);
      }
    };

    fetchNewsletters();
  }, [project?.slug]);

  const handleSubscribe = async () => {
    if (!project?.slug) return;

    try {
      setSubscriptionActionLoading(true);
      const response = await apiPost(
        `/burn/${project.slug}/newsletter/subscribe`,
      );
      setSubscriptionStatus({
        subscribed: true,
        status: response.status,
        email_address: subscriptionStatus?.email_address || "",
      });
      toast.success("Successfully subscribed to newsletter!");
    } catch (err: any) {
      toast.error(err.message || "Failed to subscribe");
    } finally {
      setSubscriptionActionLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!project?.slug) return;

    try {
      setSubscriptionActionLoading(true);
      const response = await apiPost(
        `/burn/${project.slug}/newsletter/unsubscribe`,
      );
      setSubscriptionStatus({
        subscribed: false,
        status: response.status,
        email_address: subscriptionStatus?.email_address || "",
      });
      toast.success("Successfully unsubscribed from newsletter");
    } catch (err: any) {
      toast.error(err.message || "Failed to unsubscribe");
    } finally {
      setSubscriptionActionLoading(false);
    }
  };

  return (
    <>
      {/* Newsletter Sign-up Section */}
      <div className="mb-8">
        <Heading>Manage subscription</Heading>
        {subscriptionLoading ? (
          <div className="flex justify-center items-center py-4">
            <Spinner size="sm" />
          </div>
        ) : subscriptionStatus ? (
          <>
            <p className="mb-4">
              {subscriptionStatus.subscribed
                ? `You are subscribed to the newsletter${subscriptionStatus.email_address ? ` (${subscriptionStatus.email_address})` : ""}.`
                : `You are not subscribed to the newsletter${subscriptionStatus.email_address ? ` (${subscriptionStatus.email_address})` : ""}.`}
            </p>
            <div>
              {subscriptionStatus.subscribed ? (
                <Button
                  color="danger"
                  variant="flat"
                  onPress={handleUnsubscribe}
                  isLoading={subscriptionActionLoading}
                  disabled={subscriptionActionLoading}
                >
                  Unsubscribe
                </Button>
              ) : (
                <Button
                  color="primary"
                  onPress={handleSubscribe}
                  isLoading={subscriptionActionLoading}
                  disabled={subscriptionActionLoading}
                >
                  Subscribe
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="mb-4">
            Please log in to manage your newsletter subscription.
          </p>
        )}
      </div>

      {/* Newsletter Archive Section */}
      <div>
        <Heading>Newsletter archive</Heading>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-red-500">Error: {error}</div>
        ) : newsletters.length === 0 ? (
          <div className="text-gray-500">No newsletters available.</div>
        ) : (
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
        )}
      </div>
    </>
  );
}
