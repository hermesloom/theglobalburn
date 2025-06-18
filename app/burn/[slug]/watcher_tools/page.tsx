"use client";

import {
  Button,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell
} from "@nextui-org/react";
import ActionButton from "@/app/_components/ActionButton";
import { ReloadOutlined } from "@ant-design/icons";

import React, { useState, useEffect, useRef } from "react";
import { apiGet, apiPost } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { BurnMembership } from "@/utils/types";

interface Profile {
  id: string;
  metadata: {
    scanner_id: number,
    check_in_count: number,
  };
}


const resetCheckInCounts = (projectSlug: string, profileIds: string[]) => {
  // console.log({ profileIds })
  return Promise.all(
    profileIds.map((profileId) => {
      return apiPost(`/burn/${projectSlug}/admin/profiles/${profileId}/resetCheckInCount`)
    })
  )
}

export default function ScannerManagerPage() {
  const [scannerProfiles, setScannerProfiles] = useState<Profile[] | null>(null);
  const [membershipResults, setMembershipResults] = useState<BurnMembership[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const memberQueryRef = useRef<HTMLInputElement>(null);

  const setOrderedScannerProfiles = (scannerProfiles: Profile[]) => {
    setScannerProfiles(
      scannerProfiles.sort((a: Profile, b: Profile) =>
        a.metadata.scanner_id - b.metadata.scanner_id
      )
    )
  }

  const updateProfileScanners = (projectSlug: string) => {
    return apiGet(`/burn/${projectSlug}/admin/profiles/scanners`).then(setOrderedScannerProfiles)
  }

  const searchForMember = () => {
      setMembershipResults([]);
      setSearchError(null);

      let inputValue = memberQueryRef.current?.value;

      apiGet(`/burn/${project!.slug}/admin/pet_search/${inputValue}`)
        .then((memberships) => {
          setMembershipResults(memberships);
        })
        .catch((error) => {
          console.log({ message: error.message })
          setSearchError(error.message);
        })
  }

  const { project } = useProject();

  useEffect(() => {
    updateProfileScanners(project!.slug)

    setScannerProfiles(null);
  }, []); // Empty dependency array means this runs once on mount

  const resetAll = async () => {
    let ids = (scannerProfiles || []).map((scannerProfile) => scannerProfile.id);

    if (confirm("Are you sure?")) {
      await resetCheckInCounts(project!.slug, ids).then(() => {
        updateProfileScanners(project!.slug)
      })
    }
}

  return (
    <>
      {
        scannerProfiles ?
          <Table>
            <TableHeader>
              <TableColumn key="scanner_id">Scanner ID</TableColumn>
              <TableColumn key="check_in_count">Check-in Count</TableColumn>
              <TableColumn key="reset-count">Reset Count</TableColumn>
            </TableHeader>
            <TableBody>
              {scannerProfiles.map((scannerProfile: Profile) => {
                return <TableRow key={scannerProfile.metadata.scanner_id
                } >
                  <TableCell key="scanner_id">{scannerProfile.metadata.scanner_id}</TableCell>
                  <TableCell key="check_in_count">{scannerProfile.metadata.check_in_count}</TableCell>
                  <TableCell key="reset-count">
                    <ActionButton
                      action={{
                        key: "reset-count",
                        icon: <ReloadOutlined />,
                        onClick: async (scannerProfile) => {
                          if (scannerProfile && confirm("Are you sure?")) {
                            await resetCheckInCounts(project!.slug, [scannerProfile.id]).then(() => { updateProfileScanners(project!.slug) })
                          }
                        },
                      }}
                      data={scannerProfile}
                      size="sm"
                    />
                  </TableCell>
                </TableRow>
              })}
            </TableBody>
          </Table >
          : <div>Fetching scanner profiles...</div>
      }

            <Button
              color="secondary"
              onPress={resetAll}
            >
              <ReloadOutlined />
              Reset all
            </Button>

      <div className="flex flex-col gap-4">
        <div className="relative w-full">

          Search for a member:

          <Input type="text" ref={memberQueryRef} name="member-query" className="border border-black rounded-lg" />

          <div className="w-full h-full flex items-center justify-center">
            <Button
              color="primary"
              onPress={searchForMember}
            >
              Search
            </Button>
          </div>

          <pre>{JSON.stringify(membershipResults)}</pre>

        </div>
      </div>
    </>
  );
}
