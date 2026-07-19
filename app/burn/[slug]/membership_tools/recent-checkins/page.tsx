"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import { Spinner } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";
import Link from "next/link";
import { MemberSearchResult } from "../types";
import { MemberSearchResultCard } from "../components/MemberSearchResultCard";

export default function RecentCheckInsPage() {
  const { project } = useProject();
  const [members, setMembers] = useState<MemberSearchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!project?.slug) return;
    setLoading(true);
    apiGet(`/burn/${project.slug}/admin/recent-checkins`)
      .then((data: MemberSearchResult[]) => {
        setMembers(data);
        setError(null);
      })
      .catch((err: any) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [project?.slug]);

  if (loading) {
    return (
      <>
        <Heading>Recent Check-ins</Heading>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Heading>Recent Check-ins</Heading>
        <div className="text-red-500">Error: {error}</div>
      </>
    );
  }

  return (
    <>
      <Link
        href={`/burn/${project?.slug}/membership_tools`}
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← Back to Membership Tools
      </Link>
      <Heading>Recent Check-ins</Heading>
      <p className="text-sm text-gray-500 mb-4">Last 40 members checked in, most recent first.</p>

      {members && members.length === 0 ? (
        <div className="text-gray-500">No members checked in yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {(members || []).map((membership) => (
            <MemberSearchResultCard
              key={membership.owner_id}
              membership={membership}
              projectSlug={project!.slug}
              onRefresh={load}
            />
          ))}
        </div>
      )}
    </>
  );
}
