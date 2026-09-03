import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createEvent,
  deleteEvent,
  listClients,
  updateEvent,
  listEvents,
  validateSubaccountCode,
} from "../multitenant.js";
import { getAdminUsername } from "../adminAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getAdminUsername(req as any)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
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
  if (req.method === "PUT") {
    const id = String(req.query.id || "").trim();
    const body = (req.body || {}) as Record<string, unknown>;
    if (!id) return res.status(400).json({ error: "Event id is required" });
    try {
      const clients = await listClients().catch(() => []);
      const clientId = String(body.clientId || "").trim();
      const selectedClient = clients.find(client => client.id === clientId);
      if (clientId && !selectedClient)
        return res.status(400).json({ error: "Selected payout account was not found" });
      const event = await updateEvent(id, {
        title: typeof body.title === "string" ? body.title.trim() : undefined,
        description: typeof body.description === "string" ? body.description.trim() : undefined,
        eventDate: typeof body.eventDate === "string" ? body.eventDate.trim() : undefined,
        venue: typeof body.venue === "string" ? body.venue.trim() : undefined,
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() : undefined,
        ticketPrice: body.ticketPrice === undefined ? undefined : Number(body.ticketPrice),
        capacity: body.capacity === undefined ? undefined : Number(body.capacity),
        paystackSubaccountCode: typeof body.paystackSubaccountCode === "string" ? body.paystackSubaccountCode.trim() : selectedClient?.paystackSubaccountCode,
      });
      return res.status(200).json({ event });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update event" });
    }
  }
  if (req.method === "DELETE") {
    const id = String(req.query.id || "").trim();
    if (!id) {
      res.status(400).json({ error: "Event id is required" });
      return;
    }
    try {
      res.status(200).json({ deleted: await deleteEvent(id) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete event" });
    }
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  const clients = await listClients().catch(() => []);
  const clientId = String(body.clientId || "").trim();
  const selectedClient = clients.find(client => client.id === clientId);
  const input = {
    id: String(body.id || `EVT-${Date.now()}`).trim(),
    clientId,
    title: String(body.title || "").trim(),
    description:
      typeof body.description === "string" ? body.description.trim() : null,
    eventDate:
      typeof body.eventDate === "string" ? body.eventDate.trim() : null,
        venue:
      typeof body.venue === "string" ? body.venue.trim() : null,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() : null,
    ticketPrice: Number(body.ticketPrice),
    capacity: Number(body.capacity),
    soldCount: 0,
    paystackSubaccountCode: String(
      body.paystackSubaccountCode || process.env.PAYSTACK_SUBACCOUNT_CODE || selectedClient?.paystackSubaccountCode || ""
    ).trim(),
  };
  if (
    !input.clientId ||
    !input.title ||
    !Number.isInteger(input.ticketPrice) ||
    input.ticketPrice <= 0 ||
    !Number.isInteger(input.capacity) ||
    input.capacity <= 0 ||
    !validateSubaccountCode(input.paystackSubaccountCode)
  ) {
    res.status(400).json({
      error:
        "Event title, selected payout account, positive whole-number ticket price and capacity, and a valid Paystack payout profile are required",
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
