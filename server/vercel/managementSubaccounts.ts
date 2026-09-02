import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminUsername } from "../adminAuth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getAdminUsername(req as any)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  const businessName = String(body.businessName || "").trim();
  const email = String(body.email || "").trim();
  const accountNumber = String(body.accountNumber || "").trim();
  const bankCode = String(body.bankCode || "").trim();
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    res.status(503).json({ error: "Paystack secret is not configured" });
    return;
  }
  if (!businessName || !email || !accountNumber || !bankCode) {
    res
      .status(400)
      .json({
        error:
          "Business name, email, account number, and bank code are required",
      });
    return;
  }
  try {
    const response = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name: businessName,
        settlement_bank: bankCode,
        account_number: accountNumber,
        primary_contact_email: email,
      }),
    });
    const payload = (await response.json()) as {
      message?: string;
      data?: { subaccount_code?: string };
    };
    if (!response.ok || !payload.data?.subaccount_code) {
      res
        .status(response.status || 502)
        .json({
          error: payload.message || "Paystack could not create the subaccount",
        });
      return;
    }
    res.status(201).json({ subaccountCode: payload.data.subaccount_code });
  } catch (error) {
    res
      .status(502)
      .json({
        error:
          error instanceof Error ? error.message : "Unable to reach Paystack",
      });
  }
}
