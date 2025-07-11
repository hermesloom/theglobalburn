"use client";

import React, { useState, useEffect, useRef } from "react";
import Heading from "@/app/_components/Heading";
import { Input, Button, Card, CardBody } from "@nextui-org/react";
import { apiGet, ApiError } from "@/app/_components/api";
import { useSession, useProject } from "@/app/_components/SessionContext";
import { BurnMembership } from "@/utils/types";

import QrScanner from 'qr-scanner';

let videoEl;

let qrScanner: QrScanner,
  qrScannerEngine: any; // Using any since QrEngine type is not exported

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

interface ScannedMember {
  id: string;
  first_name: string;
  last_name: string;
  birthdate: string;
  checked_in_at: string | null;
  metadata: {
    children: Child[];
    pets: Pet[];
  };
}

const formatRelativeDateTime = (date: Date) => {
  const now = new Date();

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let relativeDay;

  if (diffDays === 0 && now.getDate() === date.getDate()) {
    relativeDay = 'Today'
  } else if (diffDays <= 1 && now.getDate() - date.getDate() === 1) {
    relativeDay = 'Yesterday';
  } else if (diffDays < 7) {
    relativeDay = `${diffDays === 1 ? "1 day" : `${diffDays} days`} ago`;
  }

  let weekday = date.toLocaleDateString('en-US', { weekday: 'long' });

  return `${weekday} at ${timeString} (${relativeDay})`;
}

const formatDOB = (dob: string) => {
  return new Date(dob).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const clickAudio = new Audio('/sounds/click.mp3');
const dingAudio = new Audio('/sounds/ding.mp3');
const deniedAudio = new Audio('/sounds/denied.mp3');
// TODO: For banned members
const buzzAudio = new Audio('/sounds/buzz.mp3');

export default function ScannerPage() {
  const { profile } = useSession();
  console.log({ profile })
  const { project } = useProject();

  const [membershipResults, setMembershipResults] = useState<BurnMembership[] | null>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const chipCodeRef = useRef<HTMLInputElement>(null);

  const searchForPet = () => {
    setMembershipResults([]);
    setSearchError(null);

    let inputValue = chipCodeRef.current?.value;

    apiGet(`/burn/${project!.slug}/admin/pet_search/${inputValue}`)
      .then((memberships) => {
        setMembershipResults(memberships);
      })
      .catch((error) => {
        console.log({ message: error.message })
        setSearchError(error.message);
      })
  };

  useEffect(() => {
    setMembershipResults(null);

  }, []); // Empty dependency array means this runs once on mount

  return (
    <>
      <Heading>Pet search (by chip code)</Heading>

      <div className="flex flex-col gap-4">
        <div className="relative w-full">

          <Input type="text" ref={chipCodeRef} name="chip_code" className="border border-black rounded-lg mb-4" />

          <div className="mb-4">
            {
              (<div className="w-full h-full flex items-center justify-center">
                <Button
                  color="primary"
                  onPress={searchForPet}
                >
                  Search
                </Button>
              </div>)
            }
          </div>

          {searchError && (
            <Card className="w-full h-full bg-orange-100">
              <CardBody className="flex flex-col justify-between">
                <div className="flex flex-col gap-2 text-center">
                  {searchError}
                </div>
              </CardBody>
            </Card>
          )}

          {membershipResults && membershipResults.length === 0 && <div>No memberships with matching pet chip code found</div>}
          {membershipResults &&
           (membershipResults.map((membership) => {
            {
              return < Card key="membership.id" className={`w-full h-full ${membership.checked_in_at == null ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <CardBody className="flex flex-col justify-between">
                  <div className="flex flex-col gap-2">
                    <p><strong>Name:</strong> {membership.first_name} {membership.last_name}</p>
                    <p><strong>Birthdate:</strong> {formatDOB(membership.birthdate)}</p>
                    <p><strong>Checked in:</strong> {membership.checked_in_at == null ? 'No' : formatRelativeDateTime(new Date(membership.checked_in_at))}</p>

                    {membership.metadata?.children?.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">Children</h4>
                        <div className="flex flex-col gap-2">
                          {membership.metadata.children.map((child: Child) => (
                            <div key={child.key} className="pl-4 border-l-2 border-gray-200">
                              <p><strong>Name:</strong> {child.first_name} {child.last_name}</p>
                              <p><strong>Birthdate:</strong> {formatDOB(child.dob)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {membership.metadata?.pets?.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">Pets</h4>
                        <div className="flex flex-col gap-2">
                          {membership.metadata.pets.map((pet: Pet) => (
                            <div key={pet.key} className="pl-4 border-l-2 border-gray-200">
                              <p><strong>Name:</strong> {pet.name}</p>
                              <p><strong>Type:</strong> {pet.type}</p>
                              <p><strong>Chip Code:</strong> {pet.chip_code}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            }
          }))}
        </div>

      </div >
    </>
  );
}
