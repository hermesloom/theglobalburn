"use client";

import React, { useState, useEffect } from "react";
import { Checkbox, Spinner, Button, Alert } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import MemberDetailsWithHeading from "./helpers/MemberDetailsWithHeading";
import { BurnMembershipPricing, BurnStage } from "@/utils/types";
import { formatMoney } from "@/app/_components/utils";
import { apiPost, apiGet } from "@/app/_components/api";
import { useSearchParams, useRouter } from "next/navigation";
import InvitePlusOne from "./InvitePlusOne";
import ActionButton from "@/app/_components/ActionButton";
import Link from "next/link";
import {
  useBurnerQuestionnairePrompt,
  BurnerQuestionnaireResult,
} from "./helpers/useBurnerQuestionnairePrompt";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function MembershipAvailable() {
  const { project, reloadProfile } = useProject();
  const [isPolling, setIsPolling] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const burnerQuestionnaire = useBurnerQuestionnairePrompt();
  const [enabledAddons, setEnabledAddons] = useState<string[]>(
    project?.membership_purchase_right?.metadata?.enabled_addons ?? [],
  );

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setIsPolling(true);
      const checkMembership = async () => {
        try {
          const response = await apiGet(
            `/burn/${project?.slug}/has-membership`,
          );
          if (response.hasMembership) {
            await reloadProfile();
            setIsPolling(false);
            const url = new URL(window.location.href);
            url.searchParams.delete("success");
            router.replace(url.pathname + url.search);
            return true;
          }
          return false;
        } catch (error) {
          console.error("Error checking membership:", error);
          setIsPolling(false);
          return false;
        }
      };

      const pollInterval = setInterval(async () => {
        const hasMembership = await checkMembership();
        if (hasMembership) {
          clearInterval(pollInterval);
        }
      }, 2000);

      return () => {
        clearInterval(pollInterval);
        setIsPolling(false);
      };
    }
  }, [searchParams, project?.slug, reloadProfile, router]);

  const purchaseMembership = async (
    tier: number,
    burnerQuestionnaireResult?: BurnerQuestionnaireResult,
  ) => {
    const { url } = await apiPost(
      `/burn/${project?.slug}/purchase-membership`,
      {
        tier,
        originUrl: window.location.href,
        metadata: {
          enabled_addons: enabledAddons,
          burner_questionnaire_result: burnerQuestionnaireResult,
        },
      },
    );
    window.location.href = url;
  };

  const enabledAddonsSuffix = enabledAddons
    .map((addon) => {
      const addonDef = project?.burn_config.membership_addons.find(
        (a) => a.id === addon,
      )!;
      return ` + ${addonDef.name} (${formatMoney(addonDef.price, project?.burn_config.membership_price_currency!)})`;
    })
    .join("");

  return (
    <>
      <div className="flex flex-col gap-4">
        {isPolling ? (
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span>Confirming your membership purchase...</span>
          </div>
        ) : (
          <>
            <p>
              There is a{" "}
              {project?.membership_purchase_right?.is_non_transferable
                ? "non-transferable "
                : ""}
              membership available for you to purchase!
            </p>
            <p>
              Your membership is reserved for you until{" "}
              <b>
                {formatDate(project?.membership_purchase_right?.expires_at!)}
              </b>
              . If you don't complete the purchase of your membership by then
              {project?.burn_config.current_stage ===
              BurnStage.OpenSaleNonTransferable
                ? ", it will be returned to the sale."
                : ", it will be released to the public in the open sale or, if you obtained it through a transfer, returned to the person who transferred it to you."}
            </p>
          </>
        )}

        {project?.burn_config.membership_addons?.length! > 0 && !isPolling ? (
          <div className="flex flex-col gap-2">
            <p>
              You can also purchase the following <b>optional</b> add-on
              {project?.burn_config.membership_addons?.length === 1 ? "" : "s"}{" "}
              for your membership:
            </p>
            {project?.burn_config.membership_addons.map((addon) => (
              <div key={addon.id} className="flex flex-row gap-2 ml-10">
                <div className="flex flex-col items-center justify-center">
                  <Checkbox
                    isSelected={enabledAddons.includes(addon.id)}
                    onValueChange={(value: boolean) => {
                      setEnabledAddons(
                        value
                          ? [...enabledAddons, addon.id]
                          : enabledAddons.filter((id) => id !== addon.id),
                      );
                    }}
                  />
                </div>
                <div className="flex flex-col gap-0">
                  {addon.name} (+{" "}
                  {formatMoney(
                    addon.price,
                    project?.burn_config.membership_price_currency,
                  )}
                  )
                  <br />
                  <span className="text-xs">
                    see{" "}
                    <Link
                      href={addon.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      here
                    </Link>{" "}
                    for more information
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <Alert color="default">
          <span>
            Choose a high-income membership to fund more low-income memberships
            in the Spring Sale.
          </span>
        </Alert>

        {!isPolling &&
        project?.burn_config.membership_pricing_type ===
          BurnMembershipPricing.Tiered3 ? (
          <div className="flex flex-col gap-2">
            {project.membership_purchase_right?.is_low_income ? (
              <ActionButton
                action={{
                  key: "purchase-membership-tier-1",
                  label: `Purchase ${project.membership_purchase_right?.is_non_transferable ? "non-transferable " : ""}low-income membership\n(${formatMoney(
                    project?.burn_config.membership_price_tier_1,
                    project?.burn_config.membership_price_currency,
                  )})${enabledAddonsSuffix}`,
                  allowLineBreaks: true,
                  onClick: {
                    prompt: burnerQuestionnaire,
                    handler: (_, promptData) =>
                      purchaseMembership(
                        1,
                        promptData as BurnerQuestionnaireResult,
                      ),
                  },
                }}
              />
            ) : project.lottery_ticket?.is_low_income ? (
              <Button isDisabled className="whitespace-normal py-2.5 h-auto">
                Even though you signed up to the lottery as low-income,
                unfortunately no more low-income memberships are available.
              </Button>
            ) : null}

            <ActionButton
              action={{
                key: "purchase-membership-tier-2",
                label: `Purchase ${project.membership_purchase_right?.is_non_transferable ? "non-transferable " : ""}regular-income membership\n(${formatMoney(
                  project?.burn_config.membership_price_tier_2,
                  project?.burn_config.membership_price_currency,
                )})${enabledAddonsSuffix}`,
                allowLineBreaks: true,
                onClick: {
                  prompt: burnerQuestionnaire,
                  handler: (_, promptData) =>
                    purchaseMembership(
                      2,
                      promptData as BurnerQuestionnaireResult,
                    ),
                },
              }}
            />
            <ActionButton
              action={{
                key: "purchase-membership-tier-3",
                label: `Purchase ${project.membership_purchase_right?.is_non_transferable ? "non-transferable " : ""}high-income membership\n(${formatMoney(
                  project?.burn_config.membership_price_tier_3,
                  project?.burn_config.membership_price_currency,
                )}) ${enabledAddonsSuffix}`,
                allowLineBreaks: true,
                onClick: {
                  prompt: burnerQuestionnaire,
                  handler: (_, promptData) =>
                    purchaseMembership(
                      3,
                      promptData as BurnerQuestionnaireResult,
                    ),
                },
              }}
            />
          </div>
        ) : null}
      </div>
      <InvitePlusOne />
      <MemberDetailsWithHeading data={project?.membership_purchase_right!} />
    </>
  );
}
