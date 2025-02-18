"use client";

import React from "react";
import { Button } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import ActionButton from "@/app/_components/ActionButton";
import { apiPost } from "@/app/_components/api";
import { useSession } from "@/app/_components/SessionContext";

const DEFAULT_PROJECT_SLUG = "demo-burn";

export default function Home() {
  const { profile, reloadProfile } = useSession();
  const router = useRouter();

  return (
    <div className="h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="text-6xl sm:text-8xl mb-4">❤️‍🔥</div>
      {profile?.projects.find((p) => p.slug === DEFAULT_PROJECT_SLUG) ? (
        <Button
          color="primary"
          onPress={() =>
            router.push(`/burn/${DEFAULT_PROJECT_SLUG}/membership`)
          }
        >
          Go to my membership
        </Button>
      ) : (
        <ActionButton
          action={{
            key: "join",
            label: "Join now!",
            onClick: async () => {
              await apiPost(`/burn/${DEFAULT_PROJECT_SLUG}/join`);
              await reloadProfile();
            },
          }}
        />
      )}
    </div>
  );
}
