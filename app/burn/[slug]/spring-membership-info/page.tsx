"use client";

import React, { useState, useEffect } from "react";
import Heading from "@/app/_components/Heading";
import { useProject } from "@/app/_components/SessionContext";
import { Button, Spinner } from "@nextui-org/react";
import { apiGet, apiPost, apiDelete } from "@/app/_components/api";
import { CheckOutlined } from "@ant-design/icons";

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
        <i>first-come, first-served</i> basis on this platform.
      </p>
      <p>
        <b>Our Pledge: </b> We want the Spring Membership Sale to be a
        meaningful and practical option—something you might choose if you're
        still uncertain about your plans for next summer. We're working against
        natural human behavior here, and it may take some time—perhaps even
        years—to find the right balance. We'll determine how many memberships to
        release as we learn and adjust.
      </p>
      {seatSaved ? (
        <Button
          style={{ marginTop: "2rem" }}
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
