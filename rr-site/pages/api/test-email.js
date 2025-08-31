import { Resend } from "resend";

export default async function handler(req, res) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.ALERT_FROM || "onboarding@resend.dev",
      to: process.env.ALERT_TO,
      subject: "RR-Tracker: test email",
      html: "<p>This is a test email from your RR-Tracker deployment.</p>"
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
