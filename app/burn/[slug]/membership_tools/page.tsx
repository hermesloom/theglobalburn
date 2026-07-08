"use client";

import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
} from "@nextui-org/react";
import ActionButton from "@/app/_components/ActionButton";
import { ReloadOutlined } from "@ant-design/icons";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { formatDOB, calculateAge } from "@/app/burn/[slug]/membership/components/helpers/date";
import { linkifyPhoneNumbers } from "@/utils/phoneLinks";

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
  check_in_events: {
    event_type: 'check_in' | 'check_out';
    created_at: string;
    actor_display_name: string;
  }[];
  notes: {
    note: string;
    created_at: string;
    actor_display_name: string;
  }[];
};

const formatSwedishDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const opts = { timeZone: "Europe/Stockholm" } as const;
  const parts = new Intl.DateTimeFormat("en-US", {
    ...opts, weekday: "long", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const tz = new Intl.DateTimeFormat("sv-SE", { ...opts, timeZoneName: "short" })
    .formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${get("weekday")}, ${get("month")} ${get("day")}, ${get("hour")}:${get("minute")}:${get("second")} ${tz} (${get("year")})`;
};

const formatSwedishDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });


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
  const [isSearching, setIsSearching] = useState(false);
  const [_searchError, setSearchError] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{ membershipId: string } | null>(null);
  const [notesText, setNotesText] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

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
          searchForMember(page + 1, resultsSoFar.concat(memberships))
        }
      })
      .catch((error) => {
        console.log({ message: error.message })
        setSearchError(error.message);
        setIsSearching(false);
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
      <div className="flex justify-end gap-2 mb-2">
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

      <Modal isOpen={!!notesModal} onClose={() => { if (!isSavingNotes) setNotesModal(null); }} isDismissable={!isSavingNotes} hideCloseButton={isSavingNotes}>
        <ModalContent>
          <ModalHeader>Add Note</ModalHeader>
          <ModalBody>
            <p className="text-red-600 font-semibold">⚠ These notes are for facts, not opinions</p>
            <Textarea value={notesText} onValueChange={setNotesText} placeholder="Enter note..." minRows={3} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setNotesModal(null)} isDisabled={isSavingNotes}>Cancel</Button>
            <Button color="primary" isLoading={isSavingNotes} onPress={async () => {
              if (!notesText.trim()) return;
              setIsSavingNotes(true);
              await apiPost(`/burn/${project!.slug}/admin/memberships/${notesModal!.membershipId}/notes`, { note: notesText });
              setIsSavingNotes(false);
              setNotesModal(null);
              setNotesText("");
              await searchForMember();
            }}>Add</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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

          <Input type="text" ref={memberQueryRef} name="member-query" className="border border-black rounded-lg" onKeyDown={(e) => { if (e.key === 'Enter') searchForMember() }} />

          <div className="w-full h-full flex items-center justify-center">
            <Button
              color="primary"
              onPress={() => { searchForMember() }}
            >
              Search
            </Button>
          </div>

          {membershipSearchQuery != null &&
            (isSearching ? `Searching...` :
              membershipResults.length == 0 ?
                `No membership results found for: '${membershipSearchQuery}'` :
                <div>
                  <div className="flex flex-col gap-3 mt-3">
                    {membershipResults.map((membership) => {
                      const hasBody = (
                        (membership.notes || []).length > 0 ||
                        (membership.metadata.children || []).length > 0 ||
                        (membership.metadata.pets || []).length > 0 ||
                        !!(membership.metadata.camp_name || membership.metadata.phone_number || membership.metadata.emergency_contact_onsite || membership.metadata.emergency_contact_other) ||
                        !!membership.metadata.car_registration ||
                        (membership.transfer_history || []).length > 0
                      );
                      return (
                        <div key={membership.owner_id} className="border border-gray-300 rounded-xl overflow-hidden shadow-sm">
                          {/* Header */}
                          <div className={`bg-gray-100 px-4 py-3 flex flex-wrap items-start justify-between gap-2${hasBody ? "" : " rounded-xl"}`}>
                            <div>
                              <p className="text-xl font-bold">{membership.first_name} {membership.last_name}</p>
                              <p className="text-sm text-gray-600"><a href={`mailto:${membership.profile.email}`} className="text-blue-500 underline">{membership.profile.email}</a></p>

                              {(membership.check_in_events || []).length > 0 ? (
                                <p>
                                  <p>&nbsp;</p>
                                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Check-in/out History</h3>
                                  {membership.check_in_events.map((e, i) => (
                                    <p key={i} className="text-sm">
                                      {formatSwedishDateTime(e.created_at)}: Checked <strong>{e.event_type === 'check_in' ? 'IN' : 'OUT'}</strong> by {e.actor_display_name}
                                    </p>
                                  ))}
                                </p>
                              ) : <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Not checked-in</h3>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" className="mr-5" variant="flat" onPress={() => { setNotesText(""); setNotesModal({ membershipId: membership.id }); }}>
                                Add note
                              </Button>
                              {membership.checked_in_at ? (
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
                                />
                              ) : (
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
                              )}
                            </div>
                          </div>

                          {/* Detail sections — 2-col on sm+ */}
                          {hasBody && <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(membership.notes || []).length > 0 && (
                              <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 col-span-2">
                                <h3 className="text-xs font-bold uppercase tracking-wide text-yellow-700 mb-1">Notes</h3>
                                {membership.notes.map((n, i) => (
                                  <div key={i} className="mb-2 last:mb-0">
                                    <p className="text-xs text-gray-500">{formatSwedishDateTime(n.created_at)} — {n.actor_display_name}</p>
                                    <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {(membership.metadata.children || []).length > 0 && (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Children</h3>
                                {membership.metadata.children.map((child) =>
                                  <p key={`${child.first_name}-${child.last_name}`} className="text-sm">{child.first_name} {child.last_name} — DOB: {formatDOB(child.dob)} (age {calculateAge(new Date(child.dob))})</p>
                                )}
                              </div>
                            )}

                            {(membership.metadata.pets || []).length > 0 && (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Pets</h3>
                                {membership.metadata.pets.map((pet) =>
                                  <div key={pet.chip_code} className="flex justify-between items-start gap-3 py-2 border-b border-gray-200 last:border-b-0">
                                    <div>
                                      <p className="text-sm">{pet.name} / {pet.type}</p>
                                      <p className="text-sm">Chip: {pet.chip_code}</p>
                                    </div>
                                    {pet.photo_url && (
                                      <img src={pet.photo_url} alt={pet.name} style={{ maxHeight: 100, width: "auto", borderRadius: 6, flexShrink: 0 }} />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {(membership.metadata.camp_name || membership.metadata.phone_number || membership.metadata.emergency_contact_onsite || membership.metadata.emergency_contact_other) && (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Emergency Info</h3>
                                {membership.metadata.camp_name && <p className="text-sm"><strong>Camp:</strong> {membership.metadata.camp_name}</p>}
                                {membership.metadata.phone_number && <p className="text-sm"><strong>Phone:</strong> <a href={`tel:${membership.metadata.phone_number}`} className="text-blue-500 underline">{membership.metadata.phone_number}</a></p>}
                                {membership.metadata.emergency_contact_onsite && <p className="text-sm"><strong>On-site:</strong> {linkifyPhoneNumbers(membership.metadata.emergency_contact_onsite)}</p>}
                                {membership.metadata.emergency_contact_other && <p className="text-sm"><strong>Other:</strong> {linkifyPhoneNumbers(membership.metadata.emergency_contact_other)}</p>}
                              </div>
                            )}

                            {membership.metadata.car_registration && (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Sleeper Vehicle</h3>
                                {membership.metadata.car_registration.registration_plate && <p className="text-sm"><strong>Plate:</strong> {membership.metadata.car_registration.registration_plate}</p>}
                                {membership.metadata.car_registration.camp_or_area && <p className="text-sm"><strong>Camp/Area:</strong> {membership.metadata.car_registration.camp_or_area}</p>}
                                {membership.metadata.car_registration.phone_number && <p className="text-sm"><strong>Phone:</strong> <a href={`tel:${membership.metadata.car_registration.phone_number}`} className="text-blue-500 underline">{membership.metadata.car_registration.phone_number}</a></p>}
                                {membership.metadata.car_registration.alt_contact && <p className="text-sm"><strong>Alt contact:</strong> {membership.metadata.car_registration.alt_contact}</p>}
                              </div>
                            )}

                            {(membership.transfer_history || []).length > 0 && (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 sm:col-span-2">
                                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Transfer History</h3>
                                {membership.transfer_history.map((t, i) => (
                                  <p key={i} className="text-sm">
                                    {formatSwedishDate(t.created_at)}: {t.from_first_name} {t.from_last_name} ({t.from_email}) &rarr; {t.to_email}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>}
                        </div>
                      );
                    })}
                  </div>
                </div>)}
        </div>
      </div>
    </>
  );
}
