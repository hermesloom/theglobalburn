import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole, BurnMembershipAddon } from "@/utils/types";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripeCurrenciesWithoutDecimals } from "@/app/api/_common/stripe";

const PurchaseMembershipRequestSchema = s.object({
  originUrl: s.string(),
  tier: s.number(),
  metadata: s.object(),
});

export const POST = requestWithProject<
  s.infer<typeof PurchaseMembershipRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    if (body.tier !== 1 && body.tier !== 2 && body.tier !== 3) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    if (!project?.burn_config.stripe_secret_api_key) {
      return NextResponse.json(
        { error: "No Stripe API key configured" },
        { status: 400 }
      );
    }

    if (project?.membership) {
      return NextResponse.json(
        { error: "User already has a membership" },
        { status: 400 }
      );
    }

    if (!project?.membership_purchase_right) {
      return NextResponse.json(
        { error: "User has no membership purchase right" },
        { status: 400 }
      );
    }

    if (body.tier === 1 && !project?.membership_purchase_right?.is_low_income) {
      return NextResponse.json(
        { error: "Not eligible for low income tier" },
        { status: 400 }
      );
    }

    if (
      !project.membership_purchase_right.first_name ||
      !project.membership_purchase_right.last_name ||
      !project.membership_purchase_right.birthdate
    ) {
      return NextResponse.json(
        { error: "Membership purchase right is incomplete" },
        { status: 400 }
      );
    }

    let stripeUnitAmount = [
      project.burn_config.membership_price_tier_1,
      project.burn_config.membership_price_tier_2,
      project.burn_config.membership_price_tier_3,
    ][body.tier - 1];

    const enabledAddons: BurnMembershipAddon[] = (
      (body.metadata as any).enabled_addons ?? []
    )
      .map((id: string) =>
        project.burn_config.membership_addons.find((a) => a.id === id)
      )
      .filter((a: any) => !!a);
    for (const addon of enabledAddons) {
      stripeUnitAmount += addon.price;
    }

    if (
      !stripeCurrenciesWithoutDecimals.includes(
        project.burn_config.membership_price_currency
      )
    ) {
      stripeUnitAmount = Math.round(stripeUnitAmount * 100);
    }

    const stripe = new Stripe(project.burn_config.stripe_secret_api_key);
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: profile.email,
      line_items: [
        {
          price_data: {
            currency:
              project.burn_config.membership_price_currency.toLowerCase(),
            product_data: {
              name:
                "Membership for " +
                project.name +
                enabledAddons.map((a) => " + " + a.name).join(""),
            },
            unit_amount: stripeUnitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: body.originUrl + "?success=true",
      cancel_url: body.originUrl,
      metadata: {
        membership_purchase_right_id: project.membership_purchase_right.id,
      },
    });

    if (!project.burn_config.stripe_webhook_secret) {
      const originUrl = new URL(body.originUrl);
      const whEndpoint = await stripe.webhookEndpoints.create({
        url: originUrl.origin + "/api/webhooks/stripe",
        enabled_events: ["checkout.session.completed"],
        metadata: {
          project_id: project.id,
        },
      });
      await supabase
        .from("burn_config")
        .update({
          stripe_webhook_secret: whEndpoint.secret,
        })
        .eq("id", project.burn_config.id);
    }

    await query(() =>
      supabase
        .from("burn_membership_purchase_rights")
        .update({
          metadata: body.metadata,
        })
        .eq("id", project.membership_purchase_right!.id)
    );

    return { url: stripeSession.url };
  },
  PurchaseMembershipRequestSchema,
  BurnRole.Participant
);
