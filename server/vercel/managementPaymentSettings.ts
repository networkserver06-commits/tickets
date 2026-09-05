import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminUsername } from "../adminAuth.js";
import { getMpesaProvider, isMpesaProvider, setMpesaProvider } from "../paymentSettings.js";
import { getTicketDb } from "../ticketDb.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getAdminUsername(req as any)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  const db = getTicketDb();
  if (!db) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }
  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.status(200).json({ mpesaProvider: await getMpesaProvider(db) });
      return;
    }
    if (req.method !== "PUT") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const provider = (req.body as Record<string, unknown> | undefined)?.mpesaProvider;
    if (!isMpesaProvider(provider)) {
      res.status(400).json({ error: "M-Pesa provider must be paystack or courtesytech" });
      return;
    }
    await setMpesaProvider(provider, db);
    res.status(200).json({ mpesaProvider: provider });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Unable to update payment settings" });
  }
}
