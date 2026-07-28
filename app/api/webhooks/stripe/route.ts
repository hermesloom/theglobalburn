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
import {
  buildRefundFailureEmail,
  REFUND_FAILURE_ALERT_EMAIL,
  transferRefundAmount,
} from "@/utils/stripe/transfers";
import { sendEmail } from "@/app/_components/email";

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
      const membershipPurchaseRight: BurnMembershipPurchaseRight | null =
        await query(
          () =>
            supabase
              .from("burn_membership_purchase_rights")
              .select("*")
              .eq("id", membershipPurchaseRightId)
              .eq("project_id", projectId)
              .gt("expires_at", new Date().toISOString())
              .maybeSingle(),
        );

      // Idempotency: 0 rows may mean (a) Stripe retry after we already processed,
      // or (b) duplicate payment (e.g. two checkout tabs) - another payment already
      // created the membership for this person.
      if (!membershipPurchaseRight) {
        const session = event.data.object;
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent as { id?: string })?.id;
        if (!paymentIntentId) {
          return NextResponse.json(
            {
              error: "Membership purchase right not found or expired",
            },
            { status: 400 },
          );
        }
        // Check 1: membership already exists for this payment intent (retry case)
        const existingByPaymentIntent = await query(() =>
          supabase
            .from("burn_memberships")
            .select("id")
            .eq("stripe_payment_intent_id", paymentIntentId)
            .maybeSingle(),
        );
        if (existingByPaymentIntent) {
          return NextResponse.json({ received: true }, { status: 200 });
        }
        // Check 2: membership exists for this person (duplicate payment case -
        // e.g. user paid twice in two checkout tabs; first payment created membership)
        const purchaseRightForIdentity = await query(
          () =>
            supabase
              .from("burn_membership_purchase_rights")
              .select("first_name, last_name, birthdate")
              .eq("id", membershipPurchaseRightId)
              .eq("project_id", projectId)
              .maybeSingle(),
        );
        if (
          purchaseRightForIdentity?.first_name &&
          purchaseRightForIdentity?.last_name &&
          purchaseRightForIdentity?.birthdate
        ) {
          const existingByPerson = await query(() =>
            supabase
              .from("burn_memberships")
              .select("id")
              .eq("project_id", projectId)
              .eq("first_name", purchaseRightForIdentity.first_name)
              .eq("last_name", purchaseRightForIdentity.last_name)
              .eq("birthdate", purchaseRightForIdentity.birthdate)
              .maybeSingle(),
          );
          if (existingByPerson) {
            return NextResponse.json({ received: true }, { status: 200 });
          }
        }
        return NextResponse.json(
          {
            error: "Membership purchase right not found or expired",
          },
          { status: 400 },
        );
      }

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

        const minorUnitFactor = stripeCurrenciesWithoutDecimals.includes(
          revokedMembership.price_currency.toUpperCase(),
        )
          ? 1
          : 100;

        // Refund the current membership via Stripe, minus the transfer fee.
        //
        // The amount is based on what Stripe still considers refundable, not on
        // burn_memberships.price. That column is not reduced by refunds issued
        // outside this flow, so after a manual addon refund it overstated what the
        // member held; the resulting refund exceeded the refundable balance, Stripe
        // rejected it, and the member went unpaid until someone noticed by hand.
        let refundedMinorUnits = 0;
        let refundError: string | null = null;
        let intendedMinorUnits: number | null = null;

        if (revokedMembership.stripe_payment_intent_id) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(
              revokedMembership.stripe_payment_intent_id,
              { expand: ["latest_charge"] },
            );
            const charge = paymentIntent.latest_charge as Stripe.Charge | null;
            if (!charge) {
              throw new Error("payment intent has no charge to refund");
            }
            const amount = transferRefundAmount(
              charge.amount - charge.amount_refunded,
              burnConfig.transfer_fee_percentage ?? 0,
            );
            intendedMinorUnits = amount;
            if (amount > 0) {
              const refund = await stripe.refunds.create({
                payment_intent: revokedMembership.stripe_payment_intent_id,
                amount,
              });
              // Record what Stripe actually did, not what we asked for.
              refundedMinorUnits = refund.amount;
            }
          } catch (e: any) {
            refundError = e?.message ?? String(e);
            console.error(
              `[ERROR] transfer refund failed for membership ${revokedMembership.id} ` +
                `(payment intent ${revokedMembership.stripe_payment_intent_id}); ` +
                `the transfer will still complete and this member is owed money`,
              e,
            );
          }
        }

        // Log the transfer before deleting the membership. A failed refund is
        // recorded on the row rather than left to a log line, so the people owed
        // money can be found with a query.
        await query(() =>
          supabase.from("burn_membership_transfers").insert({
            project_id: projectId,
            from_owner_id: revokedMembership.owner_id,
            to_owner_id: membershipPurchaseRight.owner_id,
            refund_amount: refundedMinorUnits / minorUnitFactor,
            price_currency: revokedMembership.price_currency,
            original_membership_json: revokedMembership,
            metadata: refundError
              ? { refund_failed: true, refund_error: refundError }
              : null,
          }),
        );

        // Someone is now owed money and only a human can fix it, so tell them.
        // Wrapped because a mail outage must not take the transfer down with it -
        // the row above is already the durable record.
        if (refundError) {
          try {
            const owner = await query(() =>
              supabase
                .from("profiles")
                .select("email")
                .eq("id", revokedMembership.owner_id)
                .maybeSingle(),
            );
            const { subject, text } = buildRefundFailureEmail({
              projectName: suitableProjects[0].name,
              memberName:
                `${revokedMembership.first_name ?? ""} ${revokedMembership.last_name ?? ""}`.trim() ||
                "unknown",
              memberEmail: owner?.email ?? null,
              membershipId: revokedMembership.id,
              paymentIntentId: revokedMembership.stripe_payment_intent_id ?? null,
              intendedAmount:
                intendedMinorUnits === null
                  ? null
                  : intendedMinorUnits / minorUnitFactor,
              currency: revokedMembership.price_currency,
              error: refundError,
            });
            await sendEmail(REFUND_FAILURE_ALERT_EMAIL, subject, text);
          } catch (e) {
            console.error(
              "[ERROR] could not send the refund-failure alert; the failure is " +
                "still recorded on the burn_membership_transfers row",
              e,
            );
          }
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
      const price =
        (stripeCurrenciesWithoutDecimals.includes(
          session.currency!.toUpperCase(),
        )
          ? session.amount_total
          : session.amount_total! / 100) ?? 0;

      const priceMinusAddons =
        price -
        (membershipPurchaseRight.metadata?.enabled_addons?.reduce(
          (acc: number, addon: string) =>
            acc +
            (burnConfig.membership_addons.find((x) => x.id === addon)?.price ??
              0),
          0,
        ) ?? 0);
      const isLowIncome =
        priceMinusAddons === burnConfig.membership_price_tier_1;

      await query(() =>
        supabase.from("burn_memberships").insert({
          project_id: projectId,
          owner_id: (membershipPurchaseRight as any).owner_id,
          first_name: membershipPurchaseRight.first_name,
          last_name: membershipPurchaseRight.last_name,
          birthdate: membershipPurchaseRight.birthdate,
          stripe_payment_intent_id: session.payment_intent!,
          price,
          price_currency: session.currency!.toUpperCase(),
          metadata: membershipPurchaseRight.metadata,
          is_low_income: isLowIncome,
          is_non_transferable: membershipPurchaseRight.is_non_transferable,
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
