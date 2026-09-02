export async function sendTicketConfirmation(input: { to: string; buyerName: string; reference: string; eventTitle?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !input.to) return { sent: false, skipped: true };
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [input.to], subject: `Your Passage ticket${input.eventTitle ? ` for ${input.eventTitle}` : ""}`, html: `<p>Hello ${input.buyerName},</p><p>Your payment was received successfully. Your ticket reference is <strong>${input.reference}</strong>.</p><p>Keep this reference available for entry.</p>` }) });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
  return { sent: true, skipped: false };
}
