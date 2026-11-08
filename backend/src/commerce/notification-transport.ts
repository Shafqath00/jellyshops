import nodemailer from "nodemailer";
import { UncertainDeliveryError, type NotificationMessage, type NotificationTransport } from "./notifications.js";

export function smtpNotificationTransport(options: { host: string; port: number; secure: boolean; user: string; password: string; from: string; verifiedDomain: boolean }): NotificationTransport {
  if (!options.verifiedDomain || !options.host || !options.user || !options.password || !options.from) throw new Error("SMTP requires credentials and a verified sending domain");
  const sender = nodemailer.createTransport({ host: options.host, port: options.port, secure: options.secure, requireTLS: !options.secure, auth: { user: options.user, pass: options.password }, connectionTimeout: 15000, socketTimeout: 30000, greetingTimeout: 15000 });
  return { async send(message: NotificationMessage) {
    try {
      const receipt = await sender.sendMail({ from: options.from, to: message.to, replyTo: message.replyTo, subject: message.subject, html: message.html, text: message.text, messageId: `<${message.id}@${options.from.split("@").pop()?.replace(/[>\s]/g, "")}>` });
      if (!receipt.accepted?.length) throw new Error("SMTP server did not accept the recipient");
      return { messageId: receipt.messageId };
    } catch (error) {
      const detail = error as { code?: string; command?: string; responseCode?: number };
      // Explicit SMTP rejection and pre-DATA connection failures are retryable. Lost DATA replies are ambiguous.
      if (!detail.responseCode && !["CONN", "AUTH", "EHLO", "HELO", "MAIL FROM", "RCPT TO"].includes(detail.command ?? "")) throw new UncertainDeliveryError("SMTP delivery outcome is unknown; inspect the provider before resending");
      throw error;
    }
  } };
}
