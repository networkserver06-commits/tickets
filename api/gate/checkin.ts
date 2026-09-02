import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { eventTickets, tickets } from "../../drizzle/ticketing-schema";
import { getTicketDb } from "../../server/ticketDb";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const expected = process.env.GATE_CHECKIN_PIN;
  if (!expected || req.headers["x-gate-pin"] !== expected) {
    res.status(401).json({ valid: false, error: "Invalid gate PIN" });
    return;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  const ticketId = String(body.ticketId || "").trim();
  const phone = String(body.phone || "").trim();
  const db = getTicketDb();
  if (!db) {
    res.status(503).json({ valid: false, error: "Database unavailable" });
    return;
  }
  if (!ticketId && phone) {
    const found = await db
      .select({ id: eventTickets.id })
      .from(eventTickets)
      .where(
        and(
          eq(eventTickets.buyerPhone, phone),
          eq(eventTickets.status, "valid")
        )
      )
      .limit(1);
    if (!found[0]) {
      res
        .status(409)
        .json({
          valid: false,
          error: "No valid ticket found for that phone number",
        });
      return;
    }
    const updated = await db
      .update(eventTickets)
      .set({ status: "used", scannedAt: new Date().toISOString() })
      .where(
        and(eq(eventTickets.id, found[0].id), eq(eventTickets.status, "valid"))
      )
      .returning({ id: eventTickets.id });
    if (!updated.length) {
      res
        .status(409)
        .json({ valid: false, error: "Ticket has already been used" });
      return;
    }
    res.status(200).json({ valid: true, ticketId: found[0].id });
    return;
  }
  const eventUpdated = await db
    .update(eventTickets)
    .set({ status: "used", scannedAt: new Date().toISOString() })
    .where(and(eq(eventTickets.id, ticketId), eq(eventTickets.status, "valid")))
    .returning({ id: eventTickets.id });
  if (eventUpdated.length) {
    res.status(200).json({ valid: true, ticketId });
    return;
  }
  const legacyUpdated = await db
    .update(tickets)
    .set({ status: "used" })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, "valid")))
    .returning({ id: tickets.id });
  if (!legacyUpdated.length) {
    res
      .status(409)
      .json({ valid: false, error: "Ticket is missing or already used" });
    return;
  }
  res.status(200).json({ valid: true, ticketId });
}
