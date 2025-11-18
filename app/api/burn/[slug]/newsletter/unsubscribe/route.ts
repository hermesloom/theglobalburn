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
        // Check if member exists
        const existingMember = await mailchimp.lists.getListMember(
          MAILCHIMP_LIST_ID,
          subscriberHash,
        );

        // If already unsubscribed, return success
        if (existingMember.status === "unsubscribed") {
          return {
            success: true,
            message: "Already unsubscribed",
            status: "unsubscribed",
          };
        }

        // Update member to unsubscribed
        const updatedMember = await mailchimp.lists.updateListMember(
          MAILCHIMP_LIST_ID,
          subscriberHash,
          {
            status: "unsubscribed",
          },
        );

        return {
          success: true,
          message: "Successfully unsubscribed",
          status: updatedMember.status,
        };
      } catch (error: any) {
        // If member doesn't exist, consider it already unsubscribed
        if (error.status === 404) {
          return {
            success: true,
            message: "Not subscribed",
            status: "not_found",
          };
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Error unsubscribing from newsletter:", error);
      return NextResponse.json(
        { error: error.message || "Failed to unsubscribe from newsletter" },
        { status: 500 },
      );
    }
  },
);

