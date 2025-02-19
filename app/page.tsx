"use client";

import React from "react";
import { Button } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import ActionButton from "@/app/_components/ActionButton";
import { apiPost } from "@/app/_components/api";
import { useSession } from "@/app/_components/SessionContext";
import { BurnStage } from "@/utils/types";

const DEFAULT_PROJECT_SLUG = "the-borderland-2025";

export default function Home() {
  const { profile, reloadProfile } = useSession();
  const router = useRouter();
  const project = profile?.projects.find(
    (p) => p.slug === DEFAULT_PROJECT_SLUG,
  );

  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <div className="text-8xl mb-4">❤️‍🔥</div>
      {project ? (
        <Button
          color="primary"
          onPress={() =>
            router.push(`/burn/${DEFAULT_PROJECT_SLUG}/membership`)
          }
        >
          {project.burn_config.current_stage === BurnStage.LotteryOpen
            ? "Click here to go to the lottery"
            : "Manage my membership"}
        </Button>
      ) : (
        <ActionButton
          action={{
            key: "join",
            label: "Please click here!",
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
