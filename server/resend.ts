export async function sendTicketConfirmation(input: {
  to: string;
  buyerName: string;
  reference: string;
  eventTitle?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const publicBaseUrl = (process.env.VITE_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (!apiKey || !from || !input.to) return { sent: false, skipped: true };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Your Passage ticket${input.eventTitle ? ` for ${input.eventTitle}` : ""}`,
      html: `<p>Hello ${input.buyerName},</p><p>Your payment was received successfully${input.eventTitle ? ` for <strong>${input.eventTitle}</strong>` : ""}.</p><p>Your ticket reference is <strong>${input.reference}</strong>.</p><p><a href="${publicBaseUrl}/ticket/${encodeURIComponent(input.reference)}">Open your digital ticket</a></p><p>Keep this reference and link available for entry. If the ticket page is still loading, refresh it after a few seconds while payment confirmation completes.</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
  return { sent: true, skipped: false };
}
