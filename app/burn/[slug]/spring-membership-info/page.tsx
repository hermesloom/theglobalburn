"use client";

import React, { useState, useEffect } from "react";
import Heading from "@/app/_components/Heading";
import { useProject } from "@/app/_components/SessionContext";
import { Button, Spinner } from "@nextui-org/react";
import { apiGet, apiPost, apiDelete } from "@/app/_components/api";
import { CheckOutlined } from "@ant-design/icons";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function SpringMembershipInfoPage() {
  const { project } = useProject();
  const [seatSaved, setSeatSaved] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSavedSeatStatus = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await apiGet(`/burn/${project?.slug}/saved-seat`);
      setSeatSaved(response.hasSavedSeat);
      setTotalCount(response.totalCount);
    } catch (error) {
      console.error("Failed to load saved seat status:", error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (project?.slug) {
      loadSavedSeatStatus(true);
    }
  }, [project?.slug]);

  const handleToggleSeat = async () => {
    try {
      setSaving(true);
      if (seatSaved) {
        await apiDelete(`/burn/${project?.slug}/saved-seat`);
      } else {
        await apiPost(`/burn/${project?.slug}/saved-seat`);
      }
      // Reload status to get the latest count from server
      await loadSavedSeatStatus();
    } catch (error) {
      console.error("Failed to toggle saved seat:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Heading>Spring Membership Sale</Heading>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  return (
    <>
      <Heading>Spring Membership Sale</Heading>
      <p className="mb-4">
        The Spring Membership Sale will operate on a{" "}
        <i>first-come, first-served</i> basis on this platform, starting on{" "}
        <b>{formatDate(project!.burn_config.open_sale_general_starting_at!)}</b>{" "}
        and staying open for one week.
      </p>
      <p>
        We know it can feel like there won’t be enough memberships in spring,
        but we’re committed to making both sales work. Since uncertainty is part
        of this, we believe transparency helps most. You can see how many fall
        memberships remain and mark that you’re waiting for spring—information
        we’ll also use when deciding on growth through the AP. And remember the
        Scandinavian truth: the sun will return, and everyone who wants to go
        will go to Borderland.
      </p>
      {seatSaved ? (
        <Button
          style={{ marginTop: "2rem" }}
          className="whitespace-normal py-2.5 h-auto"
          onPress={handleToggleSeat}
          isLoading={saving}
          isDisabled={saving}
          startContent={<CheckOutlined />}
          color="success"
        >
          There is a seat saved for you! (no commitments)
        </Button>
      ) : (
        <Button
          style={{ marginTop: "2rem" }}
          className="whitespace-normal py-2.5 h-auto"
          onPress={handleToggleSeat}
          isLoading={saving}
          isDisabled={saving}
          color="primary"
        >
          Save me a seat! (no commitments)
        </Button>
      )}
      {totalCount !== null && (
        <p className="text-xs text-gray-500 italic mt-2">
          There {totalCount === 1 ? "is" : "are"} already {totalCount} seat
          {totalCount !== 1 ? "s" : ""} saved!
        </p>
      )}
    </>
  );
}
