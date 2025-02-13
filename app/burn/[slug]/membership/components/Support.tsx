"use client";

import React, { useState } from "react";
import { Link } from "@nextui-org/link";
import Heading from "@/app/_components/Heading";

export default function InvitePlusOne() {
  return (
    <>
      <Heading className="mt-12">Support</Heading>
      <p>
        In case of any questions or issues, please contact{" "}
        <Link href="mailto:tech@theborderland.se">tech@theborderland.se</Link>.
      </p>
    </>
  );
}
