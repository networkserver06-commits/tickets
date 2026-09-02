import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { events } from "../../drizzle/ticketing-schema";
import { getTicketDb } from "../ticketDb";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const db = getTicketDb();
  if (!db) {
    res.status(503).json({ error: "Database is not configured" });
    return;
  }
  const id = String(req.query.id || "");
  if (!id) {
    res.status(400).json({ error: "Event id is required" });
    return;
  }
  try {
    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        eventDate: events.eventDate,
        venue: events.venue,
        ticketPrice: events.ticketPrice,
        capacity: events.capacity,
        soldCount: events.soldCount,
        paystackSubaccountCode: events.paystackSubaccountCode,
      })
      .from(events)
      .where(eq(events.id, id))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.status(200).json({ event: rows[0] });
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : "Unable to load event",
      });
  }
}
