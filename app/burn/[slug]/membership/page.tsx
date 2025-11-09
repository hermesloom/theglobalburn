"use client";

import React from "react";
import Heading from "@/app/_components/Heading";
import { useProject } from "@/app/_components/SessionContext";
import { BurnStage } from "@/utils/types";
import LotteryOpenNotEntered from "./components/LotteryOpenNotEntered";
import LotteryOpenEntered from "./components/LotteryOpenEntered";
import LotteryClosedNotEntered from "./components/LotteryClosedNotEntered";
import MembershipAvailableDetailsIncomplete from "./components/MembershipAvailableDetailsIncomplete";
import MembershipAvailable from "./components/MembershipAvailable";
import LotteryClosedNotWinner from "./components/LotteryClosedNotWinner";
import Member from "./components/Member";
import MembershipBeingTransferred from "./components/MembershipBeingTransferred";
import Support from "./components/Support";
import OpenSale from "./components/OpenSale";
import OpenSaleUnavailable from "./components/OpenSaleUnavailable";

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

export default function MembershipPage() {
  const { project } = useProject();
  const stage = project?.burn_config.current_stage;

  const getMembershipStatus = (): MembershipStatus => {
    if (project?.membership) {
      if (project.membership.is_being_transferred_to) {
        return MembershipStatus.MembershipBeingTransferred;
      } else {
        return MembershipStatus.Member;
      }
    } else if (project?.membership_purchase_right) {
      if (project.membership_purchase_right.details_modifiable) {
        return MembershipStatus.MembershipAvailableDetailsIncomplete;
      } else {
        return MembershipStatus.MembershipAvailable;
      }
    }

    if (stage === BurnStage.LotteryOpen) {
      if (project?.lottery_ticket) {
        return MembershipStatus.LotteryOpenEntered;
      } else {
        return MembershipStatus.LotteryOpenNotEntered;
      }
    } else if (stage === BurnStage.LotteryClosed) {
      if (project?.lottery_ticket) {
        return MembershipStatus.LotteryClosedNotWinner;
      } else {
        return MembershipStatus.LotteryClosedNotEntered;
      }
    } else if (stage === BurnStage.OpenSaleLotteryEntrantsOnly) {
      if (project?.lottery_ticket) {
        return MembershipStatus.OpenSale;
      } else {
        return MembershipStatus.OpenSaleUnavailable;
      }
    } else if (
      stage === BurnStage.OpenSaleGeneral ||
      stage === BurnStage.OpenSaleNonTransferable
    ) {
      return MembershipStatus.OpenSale;
    }
    return MembershipStatus.Invalid;
  };

  const membershipStatus = getMembershipStatus();

  const renderContent = () => {
    switch (membershipStatus) {
      case MembershipStatus.LotteryOpenNotEntered:
        return <LotteryOpenNotEntered />;
      case MembershipStatus.LotteryOpenEntered:
        return <LotteryOpenEntered />;
      case MembershipStatus.LotteryClosedNotEntered:
        return <LotteryClosedNotEntered />;
      case MembershipStatus.LotteryClosedNotWinner:
        return <LotteryClosedNotWinner />;
      case MembershipStatus.MembershipAvailableDetailsIncomplete:
        return <MembershipAvailableDetailsIncomplete />;
      case MembershipStatus.MembershipAvailable:
        return <MembershipAvailable />;
      case MembershipStatus.Member:
        return <Member />;
      case MembershipStatus.MembershipBeingTransferred:
        return <MembershipBeingTransferred />;
      case MembershipStatus.OpenSale:
        return <OpenSale />;
      case MembershipStatus.OpenSaleUnavailable:
        return <OpenSaleUnavailable />;
      case MembershipStatus.Invalid:
        return <div>Invalid membership status</div>;
    }
  };

  return (
    <>
      <Heading>
        {membershipStatus === MembershipStatus.Member ||
        membershipStatus === MembershipStatus.MembershipAvailable ||
        membershipStatus ===
          MembershipStatus.MembershipAvailableDetailsIncomplete ||
        membershipStatus === MembershipStatus.MembershipBeingTransferred
          ? "Your membership"
          : membershipStatus === MembershipStatus.OpenSale ||
              membershipStatus === MembershipStatus.OpenSaleUnavailable
            ? "Open membership sale"
            : "Membership lottery"}
      </Heading>
      {renderContent()}
      <Support />
    </>
  );
}
