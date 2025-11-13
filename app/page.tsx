"use client";

import React from "react";
import { Button } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import ActionButton from "@/app/_components/ActionButton";
import { apiPost } from "@/app/_components/api";
import { useSession } from "@/app/_components/SessionContext";
import { BurnStage } from "@/utils/types";

const DEFAULT_PROJECT_SLUG = "the-borderland-2026";

export default function Home() {
  const { profile, reloadProfile, showSidebar } = useSession();
  const router = useRouter();
  const project = profile?.projects.find(
    (p) => p.slug === DEFAULT_PROJECT_SLUG,
  );

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 md:py-12 transition-all duration-300"
      style={{
        marginLeft: showSidebar ? "4rem" : "0px",
        width: showSidebar ? "calc(100% - 4rem)" : "100%",
      }}
    >
      <div className="w-full max-w-3xl mb-8 md:mb-12">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6 md:mb-8 text-center">
          🌈 Intro (What is the Borderland?)
        </h1>
        <div className="space-y-4 md:space-y-5 text-base md:text-lg lg:text-xl leading-relaxed text-center md:text-left">
          <p>
            The Borderland is a regional burn event based on Burning Man's 10
            Principles (+ an 11th: consent). These principles guide our
            community to create a temporary city based on radical
            self-expression, communal effort, and immediacy. From its start in
            2011 with only 46 participants, the Borderland now welcomes over
            4,000 participants annually.
          </p>
          <p>
            More than just an event; it's a self-organized gathering, created
            entirely by its participants - a community of creators, dreamers,
            and builders - using decentralized tools. The Borderland is named
            for the liminal space it inhabits - between imagination and reality,
            its only boundaries are those set by your creativity.{" "}
            <a
              href="https://talk.theborderland.se"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-default-100 hover:bg-default-200 text-default-700 transition-colors duration-200"
            >
              🎙️ <span>Source: Talk</span>
            </a>
          </p>
        </div>
      </div>
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
          color="primary"
          action={{
            key: "join",
            label: "Manage my membership",
            onClick: async () => {
              if (!project) {
                await apiPost(`/burn/${DEFAULT_PROJECT_SLUG}/join`);
                await reloadProfile();
              }
              router.push(`/burn/${DEFAULT_PROJECT_SLUG}/membership`);
            },
          }}
        />
      )}
    </div>
  );
}
