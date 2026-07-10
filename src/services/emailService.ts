import nodemailer from "nodemailer";
import { env } from "../config/env";

// ── Singleton transporter ─────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE, // true for 465, false for 587
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// Verify connection on startup (non-blocking)
transporter.verify().then(() => {
  console.log("📧  SMTP connection verified — email service ready");
}).catch((err) => {
  console.error("📧  SMTP connection failed:", err.message);
});

// ── Shared HTML wrapper ───────────────────────────────────────────
const htmlWrapper = (body: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                ${env.SMTP_FROM_NAME}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                This is an automated message from ${env.SMTP_FROM_NAME}. Please do not reply.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} ${env.SMTP_FROM_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── Send OTP Email ────────────────────────────────────────────────
export async function sendOtpEmail(
  to: string,
  otp: string,
  fullName: string,
): Promise<void> {
  const html = htmlWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">
      Verify your email
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hi <strong>${fullName}</strong>, use the code below to verify your account.
      This code expires in <strong>10 minutes</strong>.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <span style="display:inline-block;background:#f3f4f6;border:2px dashed #6366f1;border-radius:10px;padding:16px 40px;font-size:36px;font-weight:700;letter-spacing:12px;color:#6366f1;">
        ${otp}
      </span>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
      If you didn't create an account, you can safely ignore this email.
    </p>
  `);

  const plainText = `Hi ${fullName},\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't create an account, please ignore this email.\n\n— ${env.SMTP_FROM_NAME}`;

  try {
    await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
      to,
      subject: `${otp} — Your ${env.SMTP_FROM_NAME} verification code`,
      text: plainText,
      html,
    });
    console.log(`📧  OTP email sent to ${to}`);
  } catch (error: any) {
    console.error(`📧  Failed to send OTP email to ${to}:`, error.message);
    throw error; // Let the caller decide whether to swallow or propagate
  }
}

// ── Send Password Reset Email ─────────────────────────────────────
export async function sendPasswordResetEmail(
  to: string,
  otp: string,
  fullName: string,
): Promise<void> {
  const html = htmlWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">
      Reset your password
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hi <strong>${fullName}</strong>, we received a request to reset your password.
      Use the code below to proceed. This code expires in <strong>10 minutes</strong>.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <span style="display:inline-block;background:#fef3c7;border:2px dashed #f59e0b;border-radius:10px;padding:16px 40px;font-size:36px;font-weight:700;letter-spacing:12px;color:#d97706;">
        ${otp}
      </span>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
      If you didn't request a password reset, you can safely ignore this email.
      Your password will remain unchanged.
    </p>
  `);

  const plainText = `Hi ${fullName},\n\nYour password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.\n\n— ${env.SMTP_FROM_NAME}`;

  try {
    await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
      to,
      subject: `${otp} — Reset your ${env.SMTP_FROM_NAME} password`,
      text: plainText,
      html,
    });
    console.log(`📧  Password reset email sent to ${to}`);
  } catch (error: any) {
    console.error(`📧  Failed to send password reset email to ${to}:`, error.message);
    throw error;
  }
}
