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

export const GET = requestWithProject(
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
        const member = await mailchimp.lists.getListMember(
          MAILCHIMP_LIST_ID,
          subscriberHash,
        );

        return {
          subscribed: member.status === "subscribed",
          status: member.status,
          email_address: (member as any).email_address || email,
        };
      } catch (error: any) {
        // If member doesn't exist, Mailchimp returns 404
        if (error.status === 404) {
          return {
            subscribed: false,
            status: "not_found",
            email_address: email,
          };
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Error checking subscription status:", error);
      return NextResponse.json(
        { error: error.message || "Failed to check subscription status" },
        { status: 500 },
      );
    }
  },
);
