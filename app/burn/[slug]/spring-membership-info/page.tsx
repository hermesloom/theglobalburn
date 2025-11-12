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
      <p>TODO: explanation text from Peter</p>
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
