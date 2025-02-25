"use client";

import React, { useState, useEffect } from "react";
import { Checkbox, Spinner } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import MemberDetailsWithHeading from "./helpers/MemberDetailsWithHeading";
import { BurnMembershipPricing } from "@/utils/types";
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

export default function MembershipAvailable() {
  const { project, reloadProfile } = useProject();
  const [isPolling, setIsPolling] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const burnerQuestionnaire = useBurnerQuestionnairePrompt();
  const [enabledAddons, setEnabledAddons] = useState<string[]>(
    project?.membership_purchase_right?.metadata?.enabled_addons ?? []
  );

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setIsPolling(true);
      const checkMembership = async () => {
        try {
          const response = await apiGet(
            `/burn/${project?.slug}/has-membership`
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
    burnerQuestionnaireResult?: BurnerQuestionnaireResult
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
      }
    );
    window.location.href = url;
  };

  const enabledAddonsSuffix = enabledAddons
    .map((addon) => {
      const addonDef = project?.burn_config.membership_addons.find(
        (a) => a.id === addon
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
            <p>There is a membership available for you to purchase!</p>
            <p>
              Your membership is reserved for you until{" "}
              <b>
                {new Date(
                  project?.membership_purchase_right?.expires_at!
                ).toLocaleString()}
              </b>
              . If you don't complete the purchase of your membership by then,
              it will be released to the public in the open sale.
            </p>
          </>
        )}

        {project?.burn_config.membership_addons?.length! > 0 ? (
          <div className="flex flex-col gap-2">
            <p>
              You can also purchase the following optional add-ons for your
              membership:
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
                          : enabledAddons.filter((id) => id !== addon.id)
                      );
                    }}
                  />
                </div>
                <div className="flex flex-col gap-0">
                  {addon.name} (+{" "}
                  {formatMoney(
                    addon.price,
                    project?.burn_config.membership_price_currency
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

        {!isPolling &&
        project?.burn_config.membership_pricing_type ===
          BurnMembershipPricing.Tiered3 ? (
          <div className="flex flex-col gap-2">
            {project.membership_purchase_right?.is_low_income ? (
              <ActionButton
                action={{
                  key: "purchase-membership-tier-1",
                  label: `Purchase low-income membership (${formatMoney(
                    project?.burn_config.membership_price_tier_1,
                    project?.burn_config.membership_price_currency
                  )})${enabledAddonsSuffix}`,
                  onClick: {
                    prompt: burnerQuestionnaire,
                    handler: (_, promptData) =>
                      purchaseMembership(
                        1,
                        promptData as BurnerQuestionnaireResult
                      ),
                  },
                }}
              />
            ) : null}

            <ActionButton
              action={{
                key: "purchase-membership-tier-2",
                label: `Purchase regular-income membership (${formatMoney(
                  project?.burn_config.membership_price_tier_2,
                  project?.burn_config.membership_price_currency
                )})${enabledAddonsSuffix}`,
                onClick: {
                  prompt: burnerQuestionnaire,
                  handler: (_, promptData) =>
                    purchaseMembership(
                      2,
                      promptData as BurnerQuestionnaireResult
                    ),
                },
              }}
            />
            <ActionButton
              action={{
                key: "purchase-membership-tier-3",
                label: `Purchase high-income membership (${formatMoney(
                  project?.burn_config.membership_price_tier_3,
                  project?.burn_config.membership_price_currency
                )})${enabledAddonsSuffix}`,
                onClick: {
                  prompt: burnerQuestionnaire,
                  handler: (_, promptData) =>
                    purchaseMembership(
                      3,
                      promptData as BurnerQuestionnaireResult
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
