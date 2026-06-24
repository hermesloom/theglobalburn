"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input, Button, Card, CardBody } from "@nextui-org/react";
import { apiGet } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { linkifyPhoneNumbers } from "@/utils/phoneLinks";

interface EmergencyInfo {
  camp_name?: string;
  phone_number?: string;
  emergency_contact_onsite?: string;
  emergency_contact_other?: string;
}

interface PetSearchMembership {
  id: string;
  first_name: string;
  last_name: string;
  checked_in_at?: string;
  profile: { email: string };
  metadata: {
    pets?: Pet[];
    emergency_info?: EmergencyInfo;
  };
}

interface Pet {
  key: string;
  name: string;
  type: string;
  chip_code: string;
  description: string;
  other_information: string;
  photo_url?: string;
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

  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });

  return `${weekday} at ${timeString} (${relativeDay})`;
}

// TODO: Wire up audio feedback - click.mp3, ding.mp3, denied.mp3, buzz.mp3

export default function ScannerPage() {
  const { project } = useProject();

  const [membershipResults, setMembershipResults] = useState<PetSearchMembership[] | null>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const chipCodeRef = useRef<HTMLInputElement>(null);

  const doSearch = (chipCode: string) => {
    setMembershipResults([]);
    setSearchError(null);
    setIsSearching(true);

    apiGet(`/burn/${project!.slug}/admin/pet_search/${chipCode}`)
      .then((memberships) => {
        setMembershipResults(memberships);
        setIsSearching(false);
      })
      .catch((error) => {
        console.log({ message: error.message })
        setSearchError(error.message);
        setIsSearching(false);
      })
  };

  const searchForPet = () => {
    doSearch(chipCodeRef.current?.value ?? "");
  };

  const showAllPets = () => {
    doSearch("__all__");
  };

  useEffect(() => {
    setMembershipResults(null);

  }, []); // Empty dependency array means this runs once on mount

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="relative w-full">

          <Input type="text" ref={chipCodeRef} name="chip_code" className="border border-black rounded-lg mb-4" onKeyDown={(e) => { if (e.key === 'Enter') searchForPet() }} />

          <div className="mb-4">
            <div className="w-full h-full flex items-center justify-center gap-4">
              <Button color="primary" onPress={searchForPet}>
                Search by chip code
              </Button>
              <Button color="secondary" onPress={showAllPets}>
                Show all memberships with pets
              </Button>
            </div>
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

          {isSearching && <div>Searching...</div>}
          {!isSearching && membershipResults && membershipResults.length === 0 && <div>No memberships with matching pet chip code found</div>}
          {membershipResults &&
            (membershipResults.map((membership) => {
              const emergency_info = membership.metadata?.emergency_info;
              return <Card key="membership.id" className={`w-full h-full ${membership.checked_in_at == null ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <CardBody className="flex flex-col justify-between">
                  <div className="flex flex-col gap-2">
                    <p><strong>Name:</strong> {membership.first_name} {membership.last_name}</p>
                    <p><strong>Email:</strong> <a href={`mailto:${membership.profile?.email}`} className="text-blue-500 underline">{membership.profile?.email}</a></p>
                    <p><strong>Checked in:</strong> {membership.checked_in_at == null ? 'No' : formatRelativeDateTime(new Date(membership.checked_in_at))}</p>

                    {emergency_info && (emergency_info.camp_name || emergency_info.phone_number || emergency_info.emergency_contact_onsite || emergency_info.emergency_contact_other) && (
                      <div className="mt-2">
                        <h4 className="font-semibold mb-1">Emergency Info</h4>
                        {emergency_info.camp_name && <p><strong>Camp Name:</strong> {emergency_info.camp_name}</p>}
                        {emergency_info.phone_number && <p><strong>Phone:</strong> <a href={`tel:${emergency_info.phone_number}`} className="text-blue-500 underline">{emergency_info.phone_number}</a></p>}
                        {emergency_info.emergency_contact_onsite && <p><strong>On-site:</strong> {linkifyPhoneNumbers(emergency_info.emergency_contact_onsite)}</p>}
                        {emergency_info.emergency_contact_other && <p><strong>Other:</strong> {linkifyPhoneNumbers(emergency_info.emergency_contact_other)}</p>}
                      </div>
                    )}

                    {(membership.metadata?.pets?.length ?? 0) > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">Pets</h4>
                        {(membership.metadata.pets ?? []).map((pet: Pet) => (
                          <div key={pet.key} className="border border-gray-300 rounded-lg p-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
                            {pet.photo_url && (
                              <img
                                src={pet.photo_url}
                                alt={pet.name}
                                style={{ maxHeight: 250, width: "auto", borderRadius: 8, flexShrink: 0 }}
                              />
                            )}
                            <div className="flex flex-col gap-1">
                              <p><strong>Name:</strong> {pet.name}</p>
                              <p><strong>Type:</strong> {pet.type}</p>
                              <p><strong>Chip Code:</strong> {pet.chip_code}</p>
                              <p><strong>Description:</strong> {pet.description}</p>
                              <p><strong>Other Info:</strong> {pet.other_information}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            }))}
        </div>

      </div >
    </>
  );
}
