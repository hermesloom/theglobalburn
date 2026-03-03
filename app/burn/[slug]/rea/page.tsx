"use client";

import Heading from "@/app/_components/Heading";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function REAPage() {
  return (
    <div>
      <Heading>Coming Soon!</Heading>

      <p className="mb-4">The Realities Employment Agency will be available for you to sign up for shifts on March 10th!</p>
    </div>
  );
}
