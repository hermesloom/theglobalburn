"use client";

import React, { useEffect, useState, useRef } from "react";
import { Spinner, Alert } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import ActionButton from "@/app/_components/ActionButton";
import toast from "react-hot-toast";
import { apiPost } from "@/app/_components/api";

export default function OpenSale() {
  const { project, reloadProfile } = useProject();
  const initialRender = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [availableMemberships, setAvailableMemberships] = useState(0);

  const updateAvailableMemberships = async () => {
    setIsLoading(true);
    const { availableMemberships } = await apiGet(
      `/burn/${project?.slug}/available-memberships`,
    );
    setAvailableMemberships(availableMemberships);
    setIsLoading(false);
  };

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      updateAvailableMemberships();
    }
  }, []);

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        There are currently{" "}
        <b>{availableMemberships < 0 ? 0 : availableMemberships}</b> memberships
        available.
      </p>
      <div className="flex flex-col gap-2">
        <ActionButton
          action={{
            key: "update-available-memberships",
            label: "Update",
            onClick: updateAvailableMemberships,
          }}
        />
        {availableMemberships > 0 ? (
          <ActionButton
            color="primary"
            action={{
              key: "reserve-membership",
              label: "Reserve my membership",
              onClick: async () => {
                await apiPost(`/burn/${project?.slug}/reserve-membership`);
                await reloadProfile();
                toast.success("Membership reserved!");
              },
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
