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
import { ReloadOutlined, UndoOutlined } from "@ant-design/icons";

import React, { useState, useEffect, useRef } from "react";
import { apiGet, apiPost } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { BurnMembership } from "@/utils/types";
import { formatDOB } from "@/app/burn/[slug]/membership/components/helpers/date";

interface Profile {
  id: string;
  email: string;
  metadata: {
    scanner_id: number,
    check_in_count: number,
  };
}

interface Child {
  dob: string;
  key: string;
  last_name: string;
  first_name: string;
}

interface Pet {
  key: string;
  name: string;
  type: string;
  chip_code: string;
}

export type MemberSearchResult = {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  birthdate: string;
  checked_in_at: string;
  profile: {
    email: string;
  };
  metadata: {
    children: Child[];
    pets: Pet[];
  };
};

// -------------------
// Credit: https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
// -------------------

function arrayToCsv(data: string[][]){
  return data.map(row =>
    row
    .map(String)  // convert every value to String
    .map(v => v.replaceAll('"', '""'))  // escape double quotes
    .map(v => `"${v}"`)  // quote it
    .join(',')  // comma-separated
  ).join('\r\n');  // rows starting on new lines
}

function downloadBlob(content: string, filename: string, contentType: string) {
  // Create a blob
  var blob = new Blob([content], { type: contentType });
  var url = URL.createObjectURL(blob);

  // Create a link to download it
  var pom = document.createElement('a');
  pom.href = url;
  pom.setAttribute('download', filename);
  pom.click();
}

// -------------------


const resetCheckInCounts = (projectSlug: string, profileIds: string[]) => {
  // console.log({ profileIds })
  return Promise.all(
    profileIds.map((profileId) => {
      return apiPost(`/burn/${projectSlug}/admin/profiles/${profileId}/resetCheckInCount`)
    })
  )
}

const resetMemberCheckIn = (projectSlug: string, profileIds: string[]) => {
  // console.log({ profileIds })
  return Promise.all(
    profileIds.map((profileId) => {
      return apiPost(`/burn/${projectSlug}/admin/profiles/${profileId}/resetMemberCheckIn`)
    })
  )
}

export default function ScannerManagerPage() {
  const [scannerProfiles, setScannerProfiles] = useState<Profile[] | null>(null);
  const [checkInCountSum, setCheckInCountSum] = useState<number>(0);
  const [membershipResults, setMembershipResults] = useState<MemberSearchResult[]>([]);
  const [membershipSearchQuery, setMembershipSearchQuery] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const memberQueryRef = useRef<HTMLInputElement>(null);

  const setOrderedScannerProfiles = (scannerProfiles: Profile[]) => {
    let profiles =
      scannerProfiles.sort((a: Profile, b: Profile) =>
        a.metadata.scanner_id - b.metadata.scanner_id
      )

    setCheckInCountSum(profiles.reduce((sum, profile) => {
      return(sum + (profile.metadata.check_in_count || 0))
    }, 0))

    setScannerProfiles(profiles);
  }

  const updateProfileScanners = (projectSlug: string) => {
    return apiGet(`/burn/${projectSlug}/admin/profiles/scanners`).then(setOrderedScannerProfiles)
  }

  const searchForMember = (page?: number, resultsSoFar?: MemberSearchResult[]) => {
    page = page || 0;
    resultsSoFar = resultsSoFar || [];

    setMembershipResults([]);
    setSearchError(null);

    let inputValue = memberQueryRef.current?.value;
    setMembershipSearchQuery(inputValue || null);

    apiPost(
      `/burn/${project?.slug}/admin/membership-search`,
      { q: inputValue, page },
    )
    .then(({data: memberships}) => {
      if (memberships.length === 0) {
        setMembershipResults(resultsSoFar);
      } else {
        searchForMember(page + 1, resultsSoFar.concat(memberships))
      }
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
    setMembershipResults([]);
    setMembershipSearchQuery(null);

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
      {scannerProfiles ?
            <div>
              <Table isStriped>
              <TableHeader>
                <TableColumn key="check_in_count">Check-in<br/>Count</TableColumn>
                <TableColumn key="scanner_id">ID</TableColumn>
                <TableColumn key="email">E-mail</TableColumn>
              </TableHeader>
              <TableBody>
                {scannerProfiles.map((scannerProfile: Profile) => {
                  return <TableRow key={`${scannerProfile.metadata.scanner_id}-${scannerProfile.email}`}>
                    <TableCell key="check_in_count" className="flex">
                      <div className="flex-none">
                        {scannerProfile.metadata.check_in_count}
                      </div>
                      <div className="grow"></div>

                      <div className="flex-none">
                        {<ActionButton
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
                            className="float-right"
                          />}
                      </div>
                    </TableCell>
                    <TableCell key="scanner_id">{scannerProfile.metadata.scanner_id}</TableCell>
                    <TableCell key="email">{scannerProfile.email}</TableCell>
                  </TableRow>
                })}
              </TableBody>
            </Table >
            <div>Check-in count sum: {checkInCountSum}</div>
          </div>:
          <div>Fetching scanner profiles...</div>}

            <Button
              color="secondary"
              className="mt-4 mb-4"
              onPress={resetAll}
            >
              <ReloadOutlined />
              Reset All Counters
            </Button>

      <div className="flex flex-col gap-4">
        <div className="relative w-full">

          Search for a member:

          <Input type="text" ref={memberQueryRef} name="member-query" className="border border-black rounded-lg" />

          <div className="w-full h-full flex items-center justify-center">
            <Button
              color="primary"
              onPress={() => { searchForMember() }}
            >
              Search
            </Button>
          </div>

          {membershipSearchQuery != null &&
            (membershipResults.length == 0 ?
            `No membership results found for: '${membershipSearchQuery}'` :
            <div>
              <Button
                color="primary"
                onPress={() => {
                    let data = [[
                      "First Name",
                      "Last Name",
                      "Birth Date",
                      "Checked-in",
                      "Children",
                      "Pets",
                    ]]

                    membershipResults.forEach((membership) => {
                      let children =
                        (membership.metadata.children || []).map((child) =>
                          `${child.first_name} ${child.last_name} - DOB: ${formatDOB(child.dob)}`
                        ).join("\n")

                      let pets =
                        (membership.metadata.pets || []).map((pet) =>
                          `${pet.name} / ${pet.type} / Chip: ${pet.chip_code}`
                        ).join("\n")

                      data.push([
                        membership.first_name,
                        membership.last_name,
                        formatDOB(membership.birthdate),
                        membership.checked_in_at,
                        children,
                        pets,
                      ])
                    })

                    downloadBlob(arrayToCsv(data), 'memberships.csv', 'text/csv;charset=utf-8;')
                  }}
              >
                Download CSV
              </Button>

              <Table isStriped>
                <TableHeader>
                  <TableColumn key="checked_in_at">Checked in at</TableColumn>
                  <TableColumn key="first_name">Name</TableColumn>
                  <TableColumn key="email">E-mail</TableColumn>
                </TableHeader>
                <TableBody>
                  {membershipResults.map((membershipResult) => {
                    return <TableRow key={membershipResult.owner_id} >
                      <TableCell key="checked_in_at">
                        <p>{membershipResult.checked_in_at}</p>

                        <p>
                          {
                            membershipResult.checked_in_at ?
                            <ActionButton
                              action={{
                                key: "reset-member-check-in",
                                label: "Check OUT",
                                onClick: async () => {
                                  if (confirm("Are you sure you want to MANUALLY CHECK OUT this member ?")) {
                                    await resetMemberCheckIn(project!.slug, [membershipResult.owner_id])

                                    await searchForMember()
                                  }
                                },
                              }}
                              data={membershipResult}
                              size="md"
                            /> :
                            <ActionButton
                              action={{
                                key: "manually-check-in",
                                label: "Check IN",
                                onClick: async () => {
                                  if (confirm("Are you sure you want to CHECK-IN this member?")) {
                                    await apiPost(`/burn/${project!.slug}/admin/check-in-member/${membershipResult.id}`)

                                    await searchForMember()
                                  }
                                },
                              }}
                              data={membershipResult}
                              size="md"
                            />
                          }
                        </p>
                      </TableCell>
                      <TableCell key="name">
                        {membershipResult.first_name}&nbsp;{membershipResult.last_name}
                      </TableCell>
                      <TableCell key="email">{membershipResult.profile.email}</TableCell>
                    </TableRow>
                  })}
                </TableBody>
              </Table >
            </div>)}
        </div>
      </div>
    </>
  );
}
