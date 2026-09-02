import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listEvents } from "../multitenant.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const events = await listEvents();
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.status(200).json({ events: events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      eventDate: event.eventDate,
      venue: event.venue,
      imageUrl: event.imageUrl,
      ticketPrice: event.ticketPrice,
      capacity: event.capacity,
      soldCount: event.soldCount,
    })) });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Unable to load events" });
  }
}
