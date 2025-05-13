import { requestWithAuthAdmin } from "@/app/api/_common/endpoints";
import { sendEmail } from "@/app/_components/email";

export const GET = requestWithAuthAdmin(async () => {
  await sendEmail(
    "tech@theborderland.se",
    "Test email",
    "This is a test email!",
  );
});
