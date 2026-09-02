import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminUsername } from "../adminAuth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!getAdminUsername(req as any)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const paystackConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
  const tursoConfigured = Boolean(process.env.TURSO_DATABASE_URL?.trim() && process.env.TURSO_AUTH_TOKEN?.trim());
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).json({ paystackConfigured, tursoConfigured, ready: paystackConfigured && tursoConfigured });
}
