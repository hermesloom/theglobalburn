import nodemailer from "nodemailer";

export type SendEmailOptions = {
  isHtml?: boolean;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
    cid?: string; // for inline images
  }>;
};

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  options: SendEmailOptions = {},
): Promise<void> {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SENDER,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_SENDER) {
    throw new Error("Missing required SMTP environment variables.");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: SMTP_SENDER,
    to,
    subject,
    text: options.isHtml ? undefined : text,
    html: options.isHtml ? text : undefined,
    attachments: options.attachments,
  });

  console.log(`Email sent to ${to}: ${info.messageId} (${subject})`);
}
