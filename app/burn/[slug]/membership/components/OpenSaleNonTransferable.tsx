"use client";

import React, { useEffect, useState, useRef } from "react";
import { Link } from "@nextui-org/link";
import { Spinner, Alert } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import ActionButton from "@/app/_components/ActionButton";
import toast from "react-hot-toast";
import { apiPost } from "@/app/_components/api";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

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

  const startingAt =
    project?.burn_config.open_sale_non_transferable_starting_at;
  const isSaleOpen = startingAt && new Date() >= new Date(startingAt);

  if (isLoading) {
    return <Spinner />;
  }

  if (!isSaleOpen) {
    return (
      <div className="flex flex-col gap-4">
        <Alert color="default">
          <span>
            The Fall Membership Sale has not started yet. It will open on{" "}
            <b>
              {startingAt ? formatDate(startingAt) : "a date to be announced"}
            </b>
            . Please check back then.
          </span>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        There are currently{" "}
        <b>{availableMemberships < 0 ? 0 : availableMemberships}</b> memberships
        available.
      </p>
      <p>The Fall Membership is non-transferable.</p>
      <p>
        See{" "}
        <Link
          isExternal
          href="https://talk.theborderland.se/d/PkDwBQaf/two-membership-sales-ap-second-iteration-of-renew-memberships-/63"
        >
          here
        </Link>{" "}
        for more background on the Fall and Spring Sale.
      </p>
      <Alert color="warning">
        <p className="mb-2">
          Warning: The Fall Membership{" "}
          <b>cannot be transferred, no matter what happens</b>. If you are not
          completely certain you’ll attend, please wait until the Spring
          Membership Sale.
        </p>
        <p>
          You can indicate{" "}
          <Link href={`/burn/${project.slug}/spring-membership-info`}>
            here
          </Link>{" "}
          that you are waiting.
        </p>
      </Alert>
      <Alert color="default">
        <span>
          A low-income option will be available to anyone who had one last year
          when using the same email. This is the best we can offer for now. A
          new application process can be created before the Spring sale if a
          dedicated low-income team forms.
        </span>
      </Alert>
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
              label: "I want to get a non-transferable Fall Membership",
              allowLineBreaks: true,
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
