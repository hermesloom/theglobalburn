"use client";

import React, { useState } from "react";
import { Link } from "@nextui-org/link";
import Heading from "@/app/_components/Heading";
import { useSession } from "@/app/_components/SessionContext";

export default function InvitePlusOne() {
  const { profile } = useSession();

  return (
    <>
      <Heading className="mt-12">Support</Heading>
      <p>
        In case of any questions or issues, please contact{" "}
        <Link href="mailto:tech@theborderland.se">tech@theborderland.se</Link>,
        preferably from the same email address with which you are signed up here
        ({profile?.email}).
      </p>
    </>
  );
}
