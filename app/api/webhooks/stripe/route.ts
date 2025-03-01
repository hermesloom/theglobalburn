import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  BurnConfig,
  BurnMembership,
  BurnMembershipPurchaseRight,
} from "@/utils/types";
import { query } from "@/app/api/_common/endpoints";
import { stripeCurrenciesWithoutDecimals } from "@/app/api/_common/stripe";

export async function POST(req: Request) {
  const supabase = await createClient();
  const allProjects = await query(() =>
    supabase.from("projects").select("*, burn_config(*)"),
  );
  let event: Stripe.Event;

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") as string;

  // TODO: use webhook endpoint metadata instead of trial-and-error to determine which project to use
  const suitableProjects = allProjects.filter((project: any) => {
    const burnConfig = project.burn_config[0];
    if (burnConfig.stripe_secret_api_key && burnConfig.stripe_webhook_secret) {
      try {
        const stripe = new Stripe(burnConfig.stripe_secret_api_key);
        event = stripe.webhooks.constructEvent(
          body,
          sig,
          burnConfig.stripe_webhook_secret,
        );
        return true;
      } catch (e: any) {
        console.log(e);
        return false;
      }
    }
    return false;
  });

  if (suitableProjects.length === 0) {
    return NextResponse.json(
      { error: "No suitable projects found" },
      { status: 400 },
    );
  } else if (suitableProjects.length > 1) {
    return NextResponse.json(
      { error: "Multiple suitable projects found" },
      { status: 400 },
    );
  }
  const projectId = suitableProjects[0].id;

  const burnConfig: BurnConfig = suitableProjects[0].burn_config[0];
  const stripe = new Stripe(burnConfig.stripe_secret_api_key);

  try {
    if (event!.type === "checkout.session.completed") {
      const membershipPurchaseRightId =
        event.data.object.metadata?.membership_purchase_right_id;
      if (!membershipPurchaseRightId) {
        return NextResponse.json(
          {
            error: "No membership purchase right ID found in session metadata",
          },
          { status: 400 },
        );
      }

      // make sure the membership purchase right exists and is not expired
      const membershipPurchaseRight: BurnMembershipPurchaseRight = await query(
        () =>
          supabase
            .from("burn_membership_purchase_rights")
            .select("*")
            .eq("id", membershipPurchaseRightId)
            .eq("project_id", projectId)
            .gt("expires_at", new Date().toISOString())
            .single(),
      );

      if (membershipPurchaseRight.details_modifiable) {
        throw new Error("Membership purchase right must not modifiable");
      }

      // mark the membership purchase right as expired
      await query(() =>
        supabase
          .from("burn_membership_purchase_rights")
          .update({
            expires_at: new Date().toISOString(),
          })
          .eq("id", membershipPurchaseRightId),
      );

      // if there is a membership with "is_being_transferred_to" being the membershipPurchaseRightId,
      // then remove that membership
      const membershipsBeingTransferred = await query(() =>
        supabase
          .from("burn_memberships")
          .select("*")
          .eq("is_being_transferred_to", membershipPurchaseRightId)
          .eq("project_id", projectId),
      );

      if (membershipsBeingTransferred.length > 0) {
        const revokedMembership: BurnMembership =
          membershipsBeingTransferred[0];
        // refund the current membership via Stripe, minus the transfer fee
        if (revokedMembership.stripe_payment_intent_id) {
          await stripe.refunds.create({
            payment_intent: revokedMembership.stripe_payment_intent_id,
            amount:
              revokedMembership.price *
              (1 - (burnConfig.transfer_fee_percentage ?? 0) / 100) *
              (stripeCurrenciesWithoutDecimals.includes(
                revokedMembership.price_currency.toUpperCase(),
              )
                ? 1
                : 100),
          });
        }

        // Delete the original membership since it's been transferred
        await query(() =>
          supabase
            .from("burn_memberships")
            .delete()
            .eq("id", membershipsBeingTransferred[0].id),
        );
      }

      const session = event.data.object;
      await query(() =>
        supabase.from("burn_memberships").insert({
          project_id: projectId,
          owner_id: (membershipPurchaseRight as any).owner_id,
          first_name: membershipPurchaseRight.first_name,
          last_name: membershipPurchaseRight.last_name,
          birthdate: membershipPurchaseRight.birthdate,
          stripe_payment_intent_id: session.payment_intent!,
          price: stripeCurrenciesWithoutDecimals.includes(
            session.currency!.toUpperCase(),
          )
            ? session.amount_total
            : session.amount_total! / 100,
          price_currency: session.currency!.toUpperCase(),
          metadata: membershipPurchaseRight.metadata,
        }),
      );

      return NextResponse.json({ received: true }, { status: 200 });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Webhook handler failed. View your Next.js function logs." },
      { status: 400 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
