"use client";

import React from "react";
import Heading from "@/app/_components/Heading";
import { Button } from "@nextui-org/react";
import { Link } from "@nextui-org/link";

export default function LinksPage() {
  return (
    <>
      <Heading>Links</Heading>
      <Link href="https://talk.theborderland.se/main/" target="_blank">
        <Button>🎙️ Talk</Button>
      </Link>
    </>
  );
}
