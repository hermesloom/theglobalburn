"use client";

import React, { useState } from "react";
import Heading from "@/app/_components/Heading";
import { useProject } from "@/app/_components/SessionContext";
import { Button } from "@nextui-org/react";
import { BurnStage } from "@/utils/types";
import { CheckOutlined } from "@ant-design/icons";

enum MembershipStatus {
  LotteryOpenNotEntered,
  LotteryOpenEntered,
  LotteryClosedNotEntered,
  LotteryClosedNotWinner,
  MembershipAvailableDetailsIncomplete,
  MembershipAvailable,
  Member,
  MembershipBeingTransferred,
  OpenSale,
  OpenSaleUnavailable,
  Invalid,
}

export default function SpringMembershipInfoPage() {
  const { project } = useProject();
  const [seatSaved, setSeatSaved] = useState(false);

  return (
    <>
      <Heading>Spring Membership Sale</Heading>
      <p className="mb-4">
        The Spring Membership Sale will operate on a{" "}
        <i>first-come, first-served</i> basis on this platform.
      </p>
      <p>
        <b>Our Pledge: </b> We want the Spring Membership Sale to be a
        meaningful and practical option—something you might choose if you’re
        still uncertain about your plans for next summer. We’re working against
        natural human behavior here, and it may take some time—perhaps even
        years—to find the right balance. We’ll determine how many memberships to
        release as we learn and adjust.
      </p>
      {seatSaved ? (
        <Button
          style={{ marginTop: "2rem" }}
          onPress={() => setSeatSaved(false)}
        >
          There is a seat saved for you! (no commitments)
        </Button>
      ) : (
        <Button
          style={{ marginTop: "2rem" }}
          onPress={() => setSeatSaved(true)}
        >
          Save me a seat! (no commitments)
        </Button>
      )}
      <p className="text-xs text-gray-500 italic">
        There were already 123 seats saved without commitment!
      </p>
    </>
  );
}
