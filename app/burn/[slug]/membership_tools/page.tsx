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
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
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
  photo_url?: string;
}

type BurnMembershipTransfer = {
  created_at: string;
  from_owner_id: string;
  from_first_name: string;
  from_last_name: string;
  from_email: string;
  to_owner_id: string;
  to_email: string;
};

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
    camp_name?: string;
    phone_number?: string;
    emergency_contact_onsite?: string;
    emergency_contact_other?: string;
    car_registration?: {
      phone_number?: string;
      alt_contact?: string;
      camp_or_area?: string;
      registration_plate?: string;
    } | null;
  };
  transfer_history: BurnMembershipTransfer[];
};

// -------------------
// Credit: https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
// -------------------

function arrayToCsv(data: string[][]) {
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
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);

  // Create a link to download it
  const pom = document.createElement('a');
  pom.href = url;
  pom.setAttribute('download', filename);
  pom.click();
}

// -------------------


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
  const [_searchError, setSearchError] = useState<string | null>(null);

  const memberQueryRef = useRef<HTMLInputElement>(null);

  const setOrderedScannerProfiles = (scannerProfiles: Profile[]) => {
    const profiles =
      scannerProfiles.sort((a: Profile, b: Profile) =>
        a.metadata.scanner_id - b.metadata.scanner_id
      )

    setCheckInCountSum(profiles.reduce((sum, profile) => {
      return (sum + (profile.metadata.check_in_count || 0))
    }, 0))

    setScannerProfiles(profiles);
  }

  const searchForMember = (page?: number, resultsSoFar?: MemberSearchResult[]) => {
    page = page || 0;
    resultsSoFar = resultsSoFar || [];

    setMembershipResults([]);
    setSearchError(null);

    const inputValue = memberQueryRef.current?.value;
    setMembershipSearchQuery(inputValue || null);

    apiPost(
      `/burn/${project?.slug}/admin/membership-search`,
      { q: inputValue, page },
    )
      .then(({ data: memberships }) => {
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
  const router = useRouter();

  useEffect(() => {
    setScannerProfiles(null);
    setMembershipResults([]);
    setMembershipSearchQuery(null);

  }, []); // Empty dependency array means this runs once on mount

  return (
    <>
      <div className="flex justify-end mb-2">
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
                    const data = [[
                      "First Name",
                      "Last Name",
                      "Birth Date",
                      "Checked-in",
                      "Children",
                      "Pets",
                    ]]

                    membershipResults.forEach((membership) => {
                      const children =
                        (membership.metadata.children || []).map((child) =>
                          `${child.first_name} ${child.last_name} - DOB: ${formatDOB(child.dob)}`
                        ).join("\n")

                      const pets =
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
                    <TableColumn key="children_pets">Children / Pets / Emergency Info / Sleeper Vehicle / Transfer History</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {membershipResults.map((membership) => {
                      return <TableRow key={membership.owner_id} >
                        <TableCell key="checked_in_at">
                          <p>{membership.checked_in_at}</p>

                          <p>
                            {
                              membership.checked_in_at ?
                                <ActionButton
                                  action={{
                                    key: "reset-member-check-in",
                                    label: "Check OUT",
                                    onClick: async () => {
                                      if (confirm("Are you sure you want to MANUALLY CHECK OUT this member ?")) {
                                        await resetMemberCheckIn(project!.slug, [membership.owner_id])

                                        await searchForMember()
                                      }
                                    },
                                  }}
                                  data={membership}
                                  size="md"
                                /> :
                                <ActionButton
                                  action={{
                                    key: "manually-check-in",
                                    label: "Check IN",
                                    onClick: async () => {
                                      if (confirm("Are you sure you want to CHECK-IN this member?")) {
                                        await apiPost(`/burn/${project!.slug}/admin/check-in-member/${membership.id}`)

                                        await searchForMember()
                                      }
                                    },
                                  }}
                                  data={membership}
                                  size="md"
                                />
                            }
                          </p>
                        </TableCell>
                        <TableCell key="name">
                          {membership.first_name}&nbsp;{membership.last_name}
                        </TableCell>
                        <TableCell key="email">{membership.profile.email}</TableCell>
                        <TableCell key="children_pets">
                          {(membership.metadata.children || []).length > 0 && (
                            <div key="children">
                              <h3 className="text-lg font-semibold mt-1">Children</h3>
                              {membership.metadata.children.map((child) =>
                                <p key={`${child.first_name}-${child.last_name}`}>{child.first_name} {child.last_name} - DOB: {formatDOB(child.dob)}</p>
                              )}
                            </div>
                          )}

                          {(membership.metadata.pets || []).length > 0 && (
                            <div key="pets">
                              <h3 className="text-lg font-semibold mt-1">Pets</h3>
                              {membership.metadata.pets.map((pet) =>
                                <div key={pet.chip_code} className="flex gap-4 items-start mb-2">
                                  {pet.photo_url && (
                                    <img src={pet.photo_url} alt={pet.name} style={{ maxHeight: 150, width: "auto", borderRadius: 8, flexShrink: 0 }} />
                                  )}
                                  <p>{pet.name} / {pet.type} / Chip: {pet.chip_code}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {(membership.metadata.camp_name || membership.metadata.phone_number || membership.metadata.emergency_contact_onsite || membership.metadata.emergency_contact_other) && (
                            <div key="emergency">
                              <h3 className="text-lg font-semibold mt-1">Emergency Info</h3>
                              {membership.metadata.camp_name && <p><strong>Camp:</strong> {membership.metadata.camp_name}</p>}
                              {membership.metadata.phone_number && <p><strong>Phone:</strong> <a href={`tel:${membership.metadata.phone_number}`} className="text-blue-500 underline">{membership.metadata.phone_number}</a></p>}
                              {membership.metadata.emergency_contact_onsite && <p><strong>On-site contact:</strong> {membership.metadata.emergency_contact_onsite}</p>}
                              {membership.metadata.emergency_contact_other && <p><strong>Other contact:</strong> {membership.metadata.emergency_contact_other}</p>}
                            </div>
                          )}

                          {membership.metadata.car_registration && (
                            <div key="car_registration">
                              <h3 className="text-lg font-semibold mt-1">Sleeper Vehicle</h3>
                              {membership.metadata.car_registration.registration_plate && <p><strong>Plate:</strong> {membership.metadata.car_registration.registration_plate}</p>}
                              {membership.metadata.car_registration.camp_or_area && <p><strong>Camp/Area:</strong> {membership.metadata.car_registration.camp_or_area}</p>}
                              {membership.metadata.car_registration.phone_number && <p><strong>Phone:</strong> <a href={`tel:${membership.metadata.car_registration.phone_number}`} className="text-blue-500 underline">{membership.metadata.car_registration.phone_number}</a></p>}
                              {membership.metadata.car_registration.alt_contact && <p><strong>Alt contact:</strong> {membership.metadata.car_registration.alt_contact}</p>}
                            </div>
                          )}

                          {(membership.transfer_history || []).length > 0 && (
                            <div key="transfer_history">
                              <h3 className="text-lg font-semibold mt-1">Transfer History</h3>
                              {membership.transfer_history.map((t, i) => (
                                <p key={i}>
                                  {new Date(t.created_at).toLocaleDateString()}: {t.from_first_name} {t.from_last_name} ({t.from_email}) &rarr; {t.to_email}
                                </p>
                              ))}
                            </div>
                          )}

                        </TableCell>
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
