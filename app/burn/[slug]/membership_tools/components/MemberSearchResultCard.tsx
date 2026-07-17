"use client";

import React, { useState } from "react";
import {
  Button,
  Checkbox,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
} from "@nextui-org/react";
import ActionButton from "@/app/_components/ActionButton";
import { formatDOB, calculateAge } from "@/app/burn/[slug]/membership/components/helpers/date";
import { linkifyPhoneNumbers } from "@/utils/phoneLinks";
import { apiPost } from "@/app/_components/api";
import { MemberSearchResult } from "../types";

const formatSwedishDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const opts = { timeZone: "Europe/Stockholm" } as const;
  const parts = new Intl.DateTimeFormat("en-US", {
    ...opts,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const tz =
    new Intl.DateTimeFormat("sv-SE", { ...opts, timeZoneName: "short" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${get("weekday")}, ${get("month")} ${get("day")}, ${get("hour")}:${get("minute")}:${get("second")} ${tz} (${get("year")})`;
};

const formatSwedishDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("sv-SE", {
    timeZone: "Europe/Stockholm",
  });

const resetMemberCheckIn = (projectSlug: string, profileId: string) =>
  apiPost(`/burn/${projectSlug}/admin/profiles/${profileId}/resetMemberCheckIn`);

interface MemberSearchResultCardProps {
  membership: MemberSearchResult;
  projectSlug: string;
  onRefresh: () => void;
}

export function MemberSearchResultCard({ membership, projectSlug, onRefresh }: MemberSearchResultCardProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [specialCircumstances, setSpecialCircumstances] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const hasBody =
    (membership.notes || []).length > 0 ||
    (membership.metadata.children || []).length > 0 ||
    (membership.metadata.pets || []).length > 0 ||
    !!(
      membership.metadata.camp_name ||
      membership.metadata.phone_number ||
      membership.metadata.emergency_contact_onsite ||
      membership.metadata.emergency_contact_other
    ) ||
    !!membership.metadata.car_registration ||
    (membership.transfer_history || []).length > 0;

  return (
    <>
      <Modal
        isOpen={notesOpen}
        onClose={() => {
          if (!isSavingNotes) {
            setNotesOpen(false);
            setSpecialCircumstances(false);
          }
        }}
        isDismissable={!isSavingNotes}
        hideCloseButton={isSavingNotes}
      >
        <ModalContent>
          <ModalHeader>Add Note</ModalHeader>
          <ModalBody>
            <p className="text-red-600 font-semibold">
              ⚠ These notes are for facts, not opinions (REMEMBER: any member
              can request their data via GDPR)
            </p>
            <Textarea
              value={notesText}
              onValueChange={setNotesText}
              placeholder="Enter note..."
              minRows={3}
            />
            <Checkbox
              isSelected={specialCircumstances}
              onValueChange={setSpecialCircumstances}
            >
              Inform gate of special circumstances (they will not see the note)
            </Checkbox>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => {
                setNotesOpen(false);
                setSpecialCircumstances(false);
              }}
              isDisabled={isSavingNotes}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isSavingNotes}
              onPress={async () => {
                if (!notesText.trim()) return;
                setIsSavingNotes(true);
                await apiPost(
                  `/burn/${projectSlug}/admin/memberships/${membership.id}/notes`,
                  { note: notesText, special_circumstances: specialCircumstances }
                );
                setIsSavingNotes(false);
                setNotesOpen(false);
                setNotesText("");
                setSpecialCircumstances(false);
                onRefresh();
              }}
            >
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <div className="border border-gray-300 rounded-xl overflow-hidden shadow-sm">
        <div
          className={`bg-gray-100 px-4 py-3 flex flex-wrap items-start justify-between gap-2${hasBody ? "" : " rounded-xl"}`}
        >
          <div>
            <p className="text-xl font-bold">
              {membership.first_name} {membership.last_name}
            </p>
            <p className="text-sm text-gray-600">
              <a
                href={`mailto:${membership.profile.email}`}
                className="text-blue-500 underline"
              >
                {membership.profile.email}
              </a>
            </p>

            {(membership.check_in_events || []).length > 0 ? (
              <p>
                <p>&nbsp;</p>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                  Check-in/out History
                </h3>
                {membership.check_in_events.map((e, i) => (
                  <p key={i} className="text-sm">
                    {formatSwedishDateTime(e.created_at)}: Checked{" "}
                    <strong>
                      {e.event_type === "check_in" ? "IN" : "OUT"}
                    </strong>{" "}
                    by {e.actor_display_name}
                  </p>
                ))}
              </p>
            ) : (
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                Not checked-in
              </h3>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="mr-5"
              variant="flat"
              onPress={() => {
                setNotesText("");
                setNotesOpen(true);
              }}
            >
              Add note
            </Button>
            {membership.checked_in_at ? (
              <ActionButton
                action={{
                  key: "reset-member-check-in",
                  label: "Check OUT",
                  onClick: async () => {
                    if (
                      confirm(
                        "Are you sure you want to MANUALLY CHECK OUT this member ?"
                      )
                    ) {
                      await resetMemberCheckIn(projectSlug, membership.owner_id);
                      onRefresh();
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
                    if (
                      confirm("Are you sure you want to CHECK-IN this member?")
                    ) {
                      await apiPost(
                        `/burn/${projectSlug}/admin/check-in-member/${membership.id}`
                      );
                      onRefresh();
                    }
                  },
                }}
                data={membership}
                size="md"
              />
            )}
          </div>
        </div>

        {hasBody && (
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(membership.notes || []).length > 0 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 col-span-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-yellow-700 mb-1">
                  Notes
                </h3>
                {membership.notes.map((n, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    <p className="text-xs text-gray-500">
                      {formatSwedishDateTime(n.created_at)} —{" "}
                      {n.actor_display_name}
                    </p>
                    {n.special_circumstances && (
                      <span className="inline-block text-xs font-semibold text-orange-700 bg-orange-100 border border-orange-300 rounded px-2 py-0.5 mb-1">
                        Gate will be informed of special circumstances
                      </span>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                  </div>
                ))}
              </div>
            )}

            {(membership.metadata.children || []).length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                  Children
                </h3>
                {membership.metadata.children.map((child) => (
                  <p
                    key={`${child.first_name}-${child.last_name}`}
                    className="text-sm"
                  >
                    {child.first_name} {child.last_name} — DOB:{" "}
                    {formatDOB(child.dob)} (age{" "}
                    {calculateAge(new Date(child.dob))})
                  </p>
                ))}
              </div>
            )}

            {(membership.metadata.pets || []).length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                  Pets
                </h3>
                {membership.metadata.pets.map((pet) => (
                  <div
                    key={pet.chip_code}
                    className="flex justify-between items-start gap-3 py-2 border-b border-gray-200 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm">
                        {pet.name} / {pet.type}
                      </p>
                      <p className="text-sm">Chip: {pet.chip_code}</p>
                    </div>
                    {pet.photo_url && (
                      <img
                        src={pet.photo_url}
                        alt={pet.name}
                        style={{
                          maxHeight: 100,
                          width: "auto",
                          borderRadius: 6,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {(membership.metadata.camp_name ||
              membership.metadata.phone_number ||
              membership.metadata.emergency_contact_onsite ||
              membership.metadata.emergency_contact_other) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                  Emergency Info
                </h3>
                {membership.metadata.camp_name && (
                  <p className="text-sm">
                    <strong>Camp:</strong> {membership.metadata.camp_name}
                  </p>
                )}
                {membership.metadata.phone_number && (
                  <p className="text-sm">
                    <strong>Phone:</strong>{" "}
                    <a
                      href={`tel:${membership.metadata.phone_number}`}
                      className="text-blue-500 underline"
                    >
                      {membership.metadata.phone_number}
                    </a>
                  </p>
                )}
                {membership.metadata.emergency_contact_onsite && (
                  <p className="text-sm">
                    <strong>On-site:</strong>{" "}
                    {linkifyPhoneNumbers(
                      membership.metadata.emergency_contact_onsite
                    )}
                  </p>
                )}
                {membership.metadata.emergency_contact_other && (
                  <p className="text-sm">
                    <strong>Other:</strong>{" "}
                    {linkifyPhoneNumbers(
                      membership.metadata.emergency_contact_other
                    )}
                  </p>
                )}
              </div>
            )}

            {membership.metadata.car_registration && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                  Sleeper Vehicle
                </h3>
                {membership.metadata.car_registration.registration_plate && (
                  <p className="text-sm">
                    <strong>Plate:</strong>{" "}
                    {membership.metadata.car_registration.registration_plate}
                  </p>
                )}
                {membership.metadata.car_registration.camp_or_area && (
                  <p className="text-sm">
                    <strong>Camp/Area:</strong>{" "}
                    {membership.metadata.car_registration.camp_or_area}
                  </p>
                )}
                {membership.metadata.car_registration.phone_number && (
                  <p className="text-sm">
                    <strong>Phone:</strong>{" "}
                    <a
                      href={`tel:${membership.metadata.car_registration.phone_number}`}
                      className="text-blue-500 underline"
                    >
                      {membership.metadata.car_registration.phone_number}
                    </a>
                  </p>
                )}
                {membership.metadata.car_registration.alt_contact && (
                  <p className="text-sm">
                    <strong>Alt contact:</strong>{" "}
                    {membership.metadata.car_registration.alt_contact}
                  </p>
                )}
              </div>
            )}

            {(membership.transfer_history || []).length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 sm:col-span-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                  Transfer History
                </h3>
                {membership.transfer_history.map((t, i) => (
                  <p key={i} className="text-sm">
                    {formatSwedishDate(t.created_at)}: {t.from_first_name}{" "}
                    {t.from_last_name} ({t.from_email}) &rarr; {t.to_email}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
