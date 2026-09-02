import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createEvent,
  listEvents,
  validateSubaccountCode,
} from "../multitenant";
import { getAdminUsername } from "../adminAuth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getAdminUsername(req as any)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  if (req.method === "GET") {
    try {
      res.status(200).json({ events: await listEvents() });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unable to load events",
      });
    }
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  const input = {
    id: String(body.id || `EVT-${Date.now()}`),
    clientId: String(body.clientId || "").trim(),
    title: String(body.title || "").trim(),
    description:
      typeof body.description === "string" ? body.description.trim() : null,
    eventDate:
      typeof body.eventDate === "string" ? body.eventDate.trim() : null,
    venue: typeof body.venue === "string" ? body.venue.trim() : null,
    ticketPrice: Number(body.ticketPrice || 0),
    capacity: Number(body.capacity || 500),
    soldCount: 0,
    paystackSubaccountCode: String(
      body.paystackSubaccountCode || process.env.PAYSTACK_SUBACCOUNT_CODE || ""
    ).trim(),
  };
  if (
    !input.clientId ||
    !input.title ||
    !Number.isFinite(input.ticketPrice) ||
    input.ticketPrice <= 0 ||
    !Number.isFinite(input.capacity) ||
    input.capacity <= 0 ||
    !validateSubaccountCode(input.paystackSubaccountCode)
  ) {
    res.status(400).json({
      error:
        "Client, title, positive ticket price, and either a valid ACCT_ code or PAYSTACK_SUBACCOUNT_CODE fallback are required",
    });
    return;
  }
  try {
    res.status(201).json({ event: await createEvent(input) });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unable to create event",
    });
  }
}
