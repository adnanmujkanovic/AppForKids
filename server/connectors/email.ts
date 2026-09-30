// Email connector. Sends only to parent-approved contacts. Without SMTP settings,
// messages stay in the parent's outbox.
import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | null | undefined;
function getTransport() {
  if (transport === undefined) transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return transport;
}

export const emailEnabled = () => !!process.env.SMTP_URL;

export async function sendEmail(to: string, subject: string, text: string): Promise<"sent" | "kept" | "failed"> {
  const t = getTransport();
  if (!t) return "kept";
  try {
    await t.sendMail({ from: process.env.SMTP_FROM ?? "SparkForge Kids <no-reply@sparkforge.app>", to, subject, text });
    return "sent";
  } catch (e) {
    console.warn("[email] send failed:", (e as Error).message);
    return "failed";
  }
}
