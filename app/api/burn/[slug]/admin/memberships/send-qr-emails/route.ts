import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole, BurnMembership, Profile } from "@/utils/types";
import { s } from "ajv-ts";
import { sendEmail } from "@/app/_components/email";
import QRCode from "qrcode";

const SendQrEmailsSchema = s.object({
  membership_ids: s.array(s.string()),
});

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const memberships: BurnMembership[] = await query(() =>
      supabase
        .from("burn_memberships")
        .select("*")
        .in("id", body.membership_ids),
    );

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
      const qrPngBuffer = await QRCode.toBuffer(m.id, { type: "png" });
      await sendEmail(
        owners[m.owner_id].email,
        "Your Borderland QR code - print or download now!",
        `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Your Borderland QR code</title>
  </head>
  <body style="font-family: Arial, sans-serif; background: #fff; color: #222; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 40px auto; padding: 24px; background: #fafafa; border-radius: 8px; border: 1px solid #eee;">
      <h2 style="color: #222;">Hi fellow Borderling!</h2>
      <p style="font-size: 16px; line-height: 1.5;">
        Here's your personal QR code. Together with <strong>your government issued ID card</strong> (not a scan, photo or copy) it will bring you past the Threshold and into the Borderland between Dreams and Realities!
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <img src="cid:qr-code" alt="Your QR Code" style="width: 200px; height: 200px; border: 1px solid #ccc; padding: 8px; background: #fff;" />
      </div>
      <p style="font-size: 16px; line-height: 1.5;">
        <strong>Please print or download this in advance</strong> since internet connectivity is really bad at the Borderland.<br><br>
        Additionally, you'll see the same QR code when you log in to the membership platform at <a href="https://members.theborderland.se/burn/the-borderland-2025/membership" style="color: #0077cc;">https://members.theborderland.se/burn/the-borderland-2025/membership</a> with the same email address that this email was sent to.
      </p>
      <p style="font-size: 16px; line-height: 1.5; margin-top: 32px;">
        See you soon!<br><br>
        <em>/The Membership team and Threshold</em>
      </p>
    </div>
  </body>
</html>`,
        {
          isHtml: true,
          attachments: [
            {
              filename: "qr-code.png",
              content: qrPngBuffer,
              contentType: "image/png",
              cid: "qr-code",
            },
          ],
        },
      );
    }
    return { success: true };
  },
  SendQrEmailsSchema,
  BurnRole.MembershipManager,
);
