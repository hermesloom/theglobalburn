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
    event_type: "check_in" | "check_out";
    created_at: string;
    actor_display_name: string;
  }[];
  notes: {
    note: string;
    created_at: string;
    actor_display_name: string;
    special_circumstances: boolean;
  }[];
};
