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

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    if (!MAILCHIMP_LIST_ID || !MAILCHIMP_DATACENTER) {
      return NextResponse.json(
        { error: "Mailchimp configuration is missing" },
        { status: 500 },
      );
    }

    try {
      const email = profile.email;
      const subscriberHash = getSubscriberHash(email);

      try {
        // Try to get existing member first
        const existingMember = await mailchimp.lists.getListMember(
          MAILCHIMP_LIST_ID,
          subscriberHash,
        );

        // If already subscribed, return success
        if (existingMember.status === "subscribed") {
          return {
            success: true,
            message: "Already subscribed",
            status: "subscribed",
          };
        }

        // Update existing member to subscribed
        const updatedMember = await mailchimp.lists.updateListMember(
          MAILCHIMP_LIST_ID,
          subscriberHash,
          {
            status: "subscribed",
            // Do not send FNAME or LNAME as per requirements
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
              // Do not send FNAME or LNAME as per requirements
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

