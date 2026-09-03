function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendTicketConfirmation(input: {
  to: string;
  buyerName: string;
  buyerPhone?: string;
  reference: string;
  eventTitle?: string;
  eventDate?: string | null;
  venue?: string | null;
  quantity?: number;
  amount?: number;
  ticketIds?: string[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")).replace(/\/$/, "");
  const ticketUrl = publicBaseUrl ? `${publicBaseUrl}/ticket/${encodeURIComponent(input.reference)}` : "";
  if (!apiKey || !from || !input.to) return { sent: false, skipped: true };

  const amountText = typeof input.amount === "number" && Number.isFinite(input.amount)
    ? new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(input.amount / 100)
    : "Confirmed payment";
  const ticketList = input.ticketIds?.length
    ? `<ul>${input.ticketIds.map(id => `<li><strong>${escapeHtml(id)}</strong></li>`).join("")}</ul>`
    : "<p>Your digital tickets are available from the button below.</p>";
  const linkBlock = ticketUrl
    ? `<p><a href="${ticketUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open your digital tickets</a></p><p style="color:#64748b;font-size:13px">If the button does not open, copy this link into your browser: ${escapeHtml(ticketUrl)}</p>`
    : "<p>Open the Passage website and use your payment reference to retrieve your digital tickets.</p>";
  const details = [
    `<tr><td style="padding:6px 0;color:#64748b">Event</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(input.eventTitle || "Passage event")}</td></tr>`,
    input.eventDate ? `<tr><td style="padding:6px 0;color:#64748b">Date</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(input.eventDate)}</td></tr>` : "",
    input.venue ? `<tr><td style="padding:6px 0;color:#64748b">Venue</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(input.venue)}</td></tr>` : "",
    `<tr><td style="padding:6px 0;color:#64748b">Quantity</td><td style="padding:6px 0;text-align:right;font-weight:600">${input.quantity || 1}</td></tr>`,
    `<tr><td style="padding:6px 0;color:#64748b">Amount paid</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#4338ca">${escapeHtml(amountText)}</td></tr>`,
    `<tr><td style="padding:6px 0;color:#64748b">Payment reference</td><td style="padding:6px 0;text-align:right;font-family:monospace;font-size:12px">${escapeHtml(input.reference)}</td></tr>`,
  ].filter(Boolean).join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Your Passage ticket${input.eventTitle ? ` for ${input.eventTitle}` : ""}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><div style="background:linear-gradient(135deg,#111827,#312e81 55%,#7c3aed);padding:28px;border-radius:16px 16px 0 0;color:#fff"><div style="display:flex;align-items:center;gap:10px"><span style="display:inline-grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#fff;color:#4f46e5;font-size:20px;font-weight:800">▣</span><span style="font-size:15px;font-weight:800;letter-spacing:2px">LEE TECH</span></div><p style="margin:18px 0 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.8">Passage digital access</p><h1 style="margin:10px 0 0;font-size:28px">Your digital ticket is ready</h1></div><div style="padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px"><p>Hello ${escapeHtml(input.buyerName)},</p><p>Your payment was received successfully. Keep this email and your digital ticket available for entry.</p><table style="width:100%;border-collapse:collapse;margin:20px 0">${details}</table><p style="margin-bottom:6px;font-weight:600">Issued ticket IDs</p>${ticketList}${linkBlock}<p style="color:#64748b;font-size:13px;line-height:1.6">Buyer email: ${escapeHtml(input.to)}${input.buyerPhone ? `<br>Phone: ${escapeHtml(input.buyerPhone)}` : ""}<br>If the ticket page is still loading, refresh it after a few seconds while payment confirmation completes. Contact the event organizer if you need help.</p><div style="margin-top:24px;padding-top:20px;border-top:1px solid #e2e8f0"><p style="margin:0;font-weight:700;color:#312e81">Thank you for choosing Passage.</p><p style="margin:6px 0 0;color:#64748b;font-size:13px;line-height:1.6">We appreciate your purchase and look forward to helping you enjoy the moment.</p><p style="margin:14px 0 0;color:#64748b;font-size:13px">Need support? Call or WhatsApp <a href="tel:+254116553618" style="color:#4338ca;font-weight:700;text-decoration:none">+254 116 553 618</a>.</p><p style="margin:14px 0 0;color:#94a3b8;font-size:11px">Powered by Lee Tech · Secure digital ticketing</p></div></div></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
  return { sent: true, skipped: false };
}
