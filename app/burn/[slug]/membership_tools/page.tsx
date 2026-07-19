"use client";

import {
  Button,
  Input,
} from "@nextui-org/react";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { MemberSearchResult } from "./types";
import { MemberSearchResultCard } from "./components/MemberSearchResultCard";

export default function ScannerManagerPage() {
  const [membershipResults, setMembershipResults] = useState<MemberSearchResult[]>([]);
  const [membershipSearchQuery, setMembershipSearchQuery] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [_searchError, setSearchError] = useState<string | null>(null);

  const memberQueryRef = useRef<HTMLInputElement>(null);

  const { project } = useProject();
  const router = useRouter();

  const searchForMember = (page?: number, resultsSoFar?: MemberSearchResult[]) => {
    page = page || 0;
    resultsSoFar = resultsSoFar || [];

    if (page === 0) {
      setMembershipResults([]);
      setSearchError(null);
      setIsSearching(true);
      const inputValue = memberQueryRef.current?.value;
      setMembershipSearchQuery(inputValue || null);
    }

    const inputValue = memberQueryRef.current?.value;

    apiPost(
      `/burn/${project?.slug}/admin/membership-search`,
      { q: inputValue, page },
    )
      .then(({ data: memberships }) => {
        if (memberships.length === 0) {
          setMembershipResults(resultsSoFar);
          setIsSearching(false);
        } else {
          searchForMember(page + 1, resultsSoFar.concat(memberships));
        }
      })
      .catch((error) => {
        console.log({ message: error.message });
        setSearchError(error.message);
        setIsSearching(false);
      });
  };

  return (
    <>
      <div className="flex justify-end gap-2 mb-2">
        <Button
          color="primary"
          variant="flat"
          onPress={() => router.push(`/burn/${project?.slug}/membership_tools/recent-checkins`)}
        >
          Recent Check-ins
        </Button>
        <Button
          color="primary"
          variant="flat"
          onPress={() => router.push(`/burn/${project?.slug}/membership_tools/note-log`)}
        >
          Note Log
        </Button>
        <Button
          color="primary"
          variant="flat"
          onPress={() => router.push(`/burn/${project?.slug}/membership_tools/statistics`)}
        >
          Statistics
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative w-full">
          <div className="text-sm text-gray-500 mb-2">
            <p>Search by:</p>
            <ul className="list-disc list-inside ml-2">
              <li>Name, email, or camp</li>
              <li>License plate — omit spaces/hyphens: <em>ABC123</em>, not <em>ABC 123</em> or <em>ABC-123</em></li>
              <li>Previous membership owner (name or email)</li>
            </ul>
          </div>
          <span>Search for a member:</span>

          <Input
            type="text"
            ref={memberQueryRef}
            name="member-query"
            className="border border-black rounded-lg"
            onKeyDown={(e) => { if (e.key === "Enter") searchForMember(); }}
          />

          <div className="w-full h-full flex items-center justify-center">
            <Button color="primary" onPress={() => searchForMember()}>
              Search
            </Button>
          </div>

          {membershipSearchQuery != null &&
            (isSearching
              ? "Searching..."
              : membershipResults.length === 0
              ? `No membership results found for: '${membershipSearchQuery}'`
              : (
                <div className="flex flex-col gap-3 mt-3">
                  {membershipResults.map((membership) => (
                    <MemberSearchResultCard
                      key={membership.owner_id}
                      membership={membership}
                      projectSlug={project!.slug}
                      onRefresh={searchForMember}
                    />
                  ))}
                </div>
              ))}
        </div>
      </div>
    </>
  );
}
