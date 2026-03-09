import { requestWithProject } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import mailchimp from "@mailchimp/mailchimp_marketing";

const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID;
const MAILCHIMP_DATACENTER = process.env.MAILCHIMP_DATACENTER;

// Initialize Mailchimp
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: MAILCHIMP_DATACENTER,
});

function getSubscriberHash(email: string): string {
  // Mailchimp requires MD5 hash of lowercase email
  const crypto = require("crypto");
  return crypto.createHash("md5").update(email.toLowerCase()).digest("hex");
}

const MEMBERS_PLATFORM_TAG = "Via members platform";

export const POST = requestWithProject(
  async (supabase, profile, _request, _body, project) => {
    if (!MAILCHIMP_LIST_ID || !MAILCHIMP_DATACENTER) {
      return NextResponse.json(
        { error: "Mailchimp configuration is missing" },
        { status: 500 },
      );
    }

    try {
      const email = profile.email;
      const subscriberHash = getSubscriberHash(email);
      const mergeFields = {
        FNAME: project?.membership?.first_name ?? "",
        LNAME: project?.membership?.last_name ?? "",
      };

      try {
        // Try to get existing member first
        const existingMember = await mailchimp.lists.getListMember(
          MAILCHIMP_LIST_ID,
          subscriberHash,
        );

        // If already subscribed, update merge fields and tags, then return success
        if (existingMember.status === "subscribed") {
          await mailchimp.lists.updateListMember(
            MAILCHIMP_LIST_ID,
            subscriberHash,
            { merge_fields: mergeFields },
          );
          await mailchimp.lists.updateListMemberTags(
            MAILCHIMP_LIST_ID,
            subscriberHash,
            {
              tags: [{ name: MEMBERS_PLATFORM_TAG, status: "active" }],
            },
          );
          return {
            success: true,
            message: "Already subscribed",
            status: "subscribed",
          };
        }

        // Update existing member to subscribed with merge fields
        const updatedMember = await mailchimp.lists.updateListMember(
          MAILCHIMP_LIST_ID,
          subscriberHash,
          {
            status: "subscribed",
            merge_fields: mergeFields,
          },
        );
        await mailchimp.lists.updateListMemberTags(
          MAILCHIMP_LIST_ID,
          subscriberHash,
          {
            tags: [
              { name: MEMBERS_PLATFORM_TAG, status: "active" },
            ],
          },
        );

        return {
          success: true,
          message: "Successfully subscribed",
          status: updatedMember.status,
        };
      } catch (error: any) {
        // If member doesn't exist (404), create new subscription
        if (error.status === 404) {
          const newMember = await mailchimp.lists.addListMember(
            MAILCHIMP_LIST_ID,
            {
              email_address: email,
              status: "subscribed",
              merge_fields: mergeFields,
            },
          );
          await mailchimp.lists.updateListMemberTags(
            MAILCHIMP_LIST_ID,
            subscriberHash,
            {
              tags: [{ name: MEMBERS_PLATFORM_TAG, status: "active" }],
            },
          );

          return {
            success: true,
            message: "Successfully subscribed",
            status: newMember.status,
          };
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Error subscribing to newsletter:", error);
      return NextResponse.json(
        { error: error.message || "Failed to subscribe to newsletter" },
        { status: 500 },
      );
    }
  },
);

