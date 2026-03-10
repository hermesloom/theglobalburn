"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Spinner, Button, Alert } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet, apiPost, apiDelete } from "@/app/_components/api";
import MembershipPrices from "@/app/burn/[slug]/membership/components/helpers/MembershipPrices";
import { BurnStage } from "@/utils/types";
import toast from "react-hot-toast";

type State = "loading" | "intro" | "maze" | "applied";

export default function LowIncomeSupportPage() {
  const { project } = useProject();
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  const config = project?.burn_config;
  const sharePct = config?.share_memberships_low_income ?? 10;

  useEffect(() => {
    if (!project?.slug) return;
    apiGet(`/burn/${project.slug}/low-income-application`)
      .then((res: { hasApplied: boolean }) => {
        setState(res.hasApplied ? "applied" : "intro");
      })
      .catch(() => setState("intro"));
  }, [project?.slug]);

  const handleApplyClick = () => setState("maze");

  const handleStarSubmit = async () => {
    if (!project?.slug || submitting) return;
    setSubmitting(true);
    try {
      await apiPost(`/burn/${project.slug}/low-income-application`);
      setState("applied");
      toast.success("Application submitted!");
    } catch {
      toast.error("Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOptOut = async () => {
    if (!project?.slug || submitting) return;
    setSubmitting(true);
    try {
      await apiDelete(`/burn/${project.slug}/low-income-application`);
      setState("intro");
      toast.success("You have opted out. You can apply again anytime.");
    } catch {
      toast.error("Failed to opt out");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return (
      <>
        <Heading>Low Income Support</Heading>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  const hasPurchaseRight = !!project?.membership_purchase_right;

  if (hasPurchaseRight) {
    return (
      <>
        <Heading>Low Income Support</Heading>
        <div className="flex flex-col gap-4">
          <p>
            If you want to change your low income status, you need to cancel
            your membership reservation first. You can do that on{" "}
            <Link
              href={`/burn/${project?.slug}/membership`}
              className="underline"
            >
              Your Membership
            </Link>
            .
          </p>
        </div>
      </>
    );
  }

  if (state === "intro") {
    return (
      <>
        <Heading>Low Income Support</Heading>
        <div className="flex flex-col gap-4">
          <p>
            The Borderland offers a minimum {sharePct}% of the total memberships
            at a lowered price. This number is additionally—and
            directly—increased by high income memberships from the previous
            sale.
          </p>
          <MembershipPrices />
          <p>
            The membership team believes that supported low income memberships
            are not a cost to The Borderland. Instead, they make The Borderland
            accessible for more members whose substantial membership
            contribution would not happen otherwise. In addition, supported
            memberships help The Borderland stay multifaceted.
          </p>
          <p>
            There&apos;s no specific income level that qualifies; instead ask
            yourself whether you need the support or not.
          </p>
          <p>
            If you need a supported membership, please take the time to apply
            here.
          </p>
          <Button color="primary" onPress={handleApplyClick} size="lg">
            Apply here
          </Button>
        </div>
      </>
    );
  }

  if (state === "maze") {
    return (
      <>
        <Heading>The Borderland bureaucracy maze</Heading>
        <div className="flex flex-col gap-4">
          <p>
            While navigating your way through the strong and just maze,
            visualize your bank statements and the personality profile that you
            want the membership team&apos;s psychic trust tank to pick up and
            evaluate you on.
          </p>
          <p>
            Clicking the apply button in the maze will submit your application.
            Only do so when you have convinced yourself that you are prepared
            and the right candidate for a supported low income membership.
          </p>
        </div>
        <div className="relative w-full max-w-md aspect-square mt-6 mb-4 mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/maze.svg"
            alt="The Borderland bureaucracy maze"
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={handleStarSubmit}
              disabled={submitting}
              className="group flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-white/85 dark:bg-black/70 backdrop-blur-sm shadow-lg border border-white/30 dark:border-white/10 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label="Submit application"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-12 h-12 text-amber-500 group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] transition-all"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
                {submitting ? "Submitting…" : "Submit Application"}
              </span>
            </button>
          </div>
        </div>
        {submitting && (
          <div className="flex justify-center">
            <Spinner size="sm" />
          </div>
        )}
      </>
    );
  }

  // applied
  const stage = config?.current_stage;
  const saleName =
    stage === BurnStage.OpenSaleNonTransferable
      ? "Fall Membership Sale"
      : "Spring Membership Sale";
  const saleIsOpen =
    (stage === BurnStage.OpenSaleGeneral &&
      !!config?.open_sale_general_starting_at &&
      +new Date() >= +new Date(config.open_sale_general_starting_at)) ||
    (stage === BurnStage.OpenSaleNonTransferable &&
      !!config?.open_sale_non_transferable_starting_at &&
      +new Date() >= +new Date(config.open_sale_non_transferable_starting_at));

  let nextStepParagraph: React.ReactNode;
  if (saleIsOpen) {
    nextStepParagraph = (
      <p>
        The {saleName} is now open. You can purchase a membership at the lowered
        price on the{" "}
        <Link href={`/burn/${project?.slug}/membership`} className="underline">
          membership page
        </Link>
        —on a first-come, first-served basis among approved applicants.
      </p>
    );
  } else {
    nextStepParagraph = (
      <p>
        When the {saleName} opens, you will be able to purchase a membership at
        the lowered price—on a first-come, first-served basis among approved
        applicants.
      </p>
    );
  }

  return (
    <>
      <Heading>Low Income Support</Heading>
      <div className="flex flex-col gap-4">
        <p>
          Congratulations! Your application has been reviewed and The Borderland
          membership team has found that you believe yourself to be the right
          candidate for a low income membership.
        </p>
        {nextStepParagraph}
        <Alert color="warning">
          Once all low income memberships have been claimed, the option will no
          longer be available, even if you applied here.
        </Alert>
        <p>
          <b>This process is trust-based.</b> Remember the golden rule:
          Don&apos;t behave in a way that forces the need for more control.
        </p>
        <p>
          If you don&apos;t need a low income membership any longer, please opt
          out by clicking the button below. You are still able to apply again.
        </p>
        <Button
          color="default"
          variant="solid"
          onPress={handleOptOut}
          isDisabled={submitting}
          startContent={submitting ? <Spinner size="sm" /> : null}
          size="lg"
          className="w-fit whitespace-normal py-2.5 h-auto"
        >
          I currently don&apos;t need a low income membership
        </Button>
      </div>
    </>
  );
}
