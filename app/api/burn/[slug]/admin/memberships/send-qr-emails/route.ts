import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole, BurnMembership, Profile } from "@/utils/types";
import { s } from "ajv-ts";
import { sendEmail } from "@/app/_components/email";
import QRCode from "qrcode";

const SendQrEmailsSchema = s.object({
  membership_ids: s.array(s.string()),
  dry_run: s.boolean().optional(),
});

export const POST = requestWithProject(
  async (supabase, profile, request, body, _project) => {
    const memberships: BurnMembership[] = await query(() =>
      supabase
        .from("burn_memberships")
        .select("*")
        .in("id", body.membership_ids),
    );

    // check if all memberships actually exist
    if (memberships.length !== body.membership_ids.length) {
      throw new Error(
        `Membership IDs not found: ${body.membership_ids
          .filter((id: string) => !memberships.some((m) => m.id === id))
          .join(", ")}`,
      );
    }

    const owners = (
      await query(() =>
        supabase
          .from("profiles")
          .select("*")
          .in(
            "id",
            memberships.map((m) => m.owner_id),
          ),
      )
    ).reduce((acc: Record<string, Profile>, curr: Profile) => {
      acc[curr.id] = curr;
      return acc;
    }, {});




    for (const m of memberships) {
      // Generate QR code as PNG buffer
      const qrPngBuffer = await QRCode.toBuffer(m.id, { type: "png", margin: 1.5 });
      const qrDataUri = `data:image/png;base64,${qrPngBuffer.toString("base64")}`;

      const meta = m.metadata || {};
      const children: any[] = meta.children || [];
      const pets: any[] = meta.pets || [];
      const car = meta.car_registration || {};
      const emergency = meta.emergency_info || {};

      let infoSections = "";

      if (children.length > 0) {
        infoSections += `<h3 style="margin: 12px 0 4px; font-size: 14px;">Accompanying Children</h3>`;
        infoSections += children
          .map(
            (c: any) =>
              `<p style="margin: 4px 0;">${c.first_name} ${c.last_name} (${c.dob})</p>`,
          )
          .join("");
      }

      if (pets.length > 0) {
        infoSections += `<h3 style="margin: 12px 0 4px; font-size: 14px;">Accompanying Pets</h3>`;
        infoSections += pets
          .map((p: any) => {
            let s = `${p.name} (${p.type})`;
            if (p.chip_code) s += `, chip: ${p.chip_code}`;
            return `<p style="margin: 4px 0;">${s}</p>`;
          })
          .join("");
      }

      if (car.registration_plate || car.phone_number || car.camp_or_area) {
        infoSections += `<h3 style="margin: 12px 0 4px; font-size: 14px;">Sleeper Vehicle</h3>`;
        if (car.registration_plate)
          infoSections += `<p style="margin: 4px 0;">Registration Plate: ${car.registration_plate}</p>`;
        if (car.phone_number)
          infoSections += `<p style="margin: 4px 0;">Phone: ${car.phone_number}</p>`;
        if (car.camp_or_area)
          infoSections += `<p style="margin: 4px 0;">Camp/Area: ${car.camp_or_area}</p>`;
      }

      if (
        emergency.phone_number ||
        emergency.camp_name ||
        emergency.emergency_contact_onsite ||
        emergency.emergency_contact_other
      ) {
        infoSections += `<h3 style="margin: 12px 0 4px; font-size: 14px;">Emergency &amp; Contact Information</h3>`;
        if (emergency.phone_number)
          infoSections += `<p style="margin: 4px 0;">Phone: ${emergency.phone_number}</p>`;
        if (emergency.camp_name)
          infoSections += `<p style="margin: 4px 0;">Camp: ${emergency.camp_name}</p>`;
        if (emergency.emergency_contact_onsite)
          infoSections += `<p style="margin: 4px 0;">On-site emergency contact: ${emergency.emergency_contact_onsite}</p>`;
        if (emergency.emergency_contact_other)
          infoSections += `<p style="margin: 4px 0;">Other emergency contact: ${emergency.emergency_contact_other}</p>`;
      }

      const memberInfoHtml = infoSections
        ? `<div class="no-print" style="margin-top: 32px;">
  <hr style="border: none; border-top: 1px solid #ccc; margin: 0 0 16px 0;" />
  <p style="font-size: 14px; margin: 0 0 8px;">Here is the information we currently have registered for your membership:</p>
  ${infoSections}
</div>`
        : "";

      let emailBody = `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Your Borderland QR code</title>
    <style>@media print { .no-print { display: none !important; } }</style>
  </head>
  <body style="font-family: Arial, sans-serif; background: #fff; color: #222; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 40px auto; padding: 24px; background: #fafafa; border-radius: 8px; border: 1px solid #eee;">
      <h2 style="color: #222;">Hello fellow Borderling,</h2>
      <p style="font-size: 16px; line-height: 1.5;">
        Here's your personal QR code. Pair it with your <strong>physical government ID</strong> (driver's license/passport/national ID - physical only: no digital/scans/photos) and you've got your passage from default world to the dream.
      </p>
      <div style="text-align: center; margin: 12px 0;">
        <img src="${qrDataUri}" alt="Your QR Code" style="width: 270px; height: 270px; border: 1px solid #ccc; padding: 8px; background: #fff;" />
        <p style="margin: 8px 0 2px; font-size: 16px; font-weight: bold;">${owners[m.owner_id].first_name} ${owners[m.owner_id].last_name}</p>
        <p style="margin: 0; font-size: 14px; color: #555;">${owners[m.owner_id].birthdate}</p>
      </div>
      <p style="font-size: 16px; line-height: 1.5;">
        <strong>Please print or download this in advance of arriving</strong> since internet connectivity is really bad at the Borderland.<br><br>
        You'll see the same QR code when you log in to <a href="https://members.theborderland.se/burn/the-borderland-2026/membership" style="color: #0077cc;">the membership platform</a> as ${owners[m.owner_id].email}.
      </p>
      <p>
        Know what to expect when arriving by reading the <a href="https://docs.superhuman.com/d/_ddTvwEwgvJw/Arriving_su_mGxe1?highlightBlockId=cl-QiYKdirLHo#_ludirLHo">Checking in</a> section of the survival guide (new information this year!)
      </p>
      <p style="font-size: 16px; line-height: 1.5;">
        Lastly, please add/verify information about children, pets, and sleeper vehicles in the membership platform (and optionally you can provide emergency contact information)! See below for the current information.
      </p>
      <p style="font-size: 16px; line-height: 1.5; margin-top: 32px;">
        See you soon!<br><br>
        <em>/The Membership Team and Threshold</em>
      </p>
      ${memberInfoHtml}
    </div>
  </body>
</html>`

      if (body.dry_run) {
        console.log(`[end-qr-emails] DRY_RUN | membership=${m.id} email=${owners[m.owner_id].email}`);
      } else {
        await sendEmail(
          owners[m.owner_id].email,
          "Your Borderland QR code - print or download now!",
          emailBody,
          {
            isHtml: true,
          },
        );
        console.log(`[end-qr-emails] membership=${m.id} email=${owners[m.owner_id].email}`);
      }
    }
    return { success: true };
  },
  SendQrEmailsSchema,
  BurnRole.MembershipManager,
);
