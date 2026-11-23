import nodemailer from "nodemailer";
import env from "../config/env.js";

const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
const transport = configured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

/** Captured messages when running tests. */
export const outbox = [];

/** In production a missing SMTP config means codes could never reach customers, so sign-up must refuse. */
export const mailAvailable = () => configured || !env.isProd;

export async function sendMail({ to, subject, html, text }) {
  const recipients = Array.isArray(to) ? to.join(", ") : to;
  if (env.isTest) {
    outbox.push({ to: recipients, subject, html, text });
    return;
  }
  if (!transport) {
    // Development without SMTP: print the message so codes can be copied from the terminal.
    console.log(`\n┌─ [mail:dev] to ${recipients}\n│  ${subject}\n│  ${String(text).split("\n").join("\n│  ")}\n└─`);
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to: recipients, subject, html, text });
}

/** Fire-and-forget for alerts: a mail problem must never break a booking or a sign-in. */
export const sendMailSafe = (msg) =>
  sendMail(msg).catch((err) => console.error(`[mail] failed to send "${msg.subject}":`, err.message));

export const verifySmtp = async () => (transport ? transport.verify().then(() => true, (e) => { console.error("[mail] SMTP check failed:", e.message); return false; }) : false);
export const smtpConfigured = configured;
