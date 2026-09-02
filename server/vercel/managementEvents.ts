import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createEvent,
  deleteEvent,
  listClients,
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
  const selectedClient = clients.find(client => client.id === String(body.clientId || "").trim()) || clients[0];
  const input = {
    id: String(body.id || `EVT-${Date.now()}`).trim(),
    clientId: selectedClient?.id || "",
    title: String(body.title || "").trim(),
    description:
      typeof body.description === "string" ? body.description.trim() : null,
    eventDate:
      typeof body.eventDate === "string" ? body.eventDate.trim() : null,
    venue: typeof body.venue === "string" ? body.venue.trim() : null,
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
    !Number.isFinite(input.ticketPrice) ||
    input.ticketPrice <= 0 ||
    !Number.isFinite(input.capacity) ||
    input.capacity <= 0 ||
    !validateSubaccountCode(input.paystackSubaccountCode)
  ) {
    res.status(400).json({
      error:
        "Event title, positive ticket price, capacity, and a configured Paystack payout profile are required",
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
