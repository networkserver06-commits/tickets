import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { eventTickets, events, orders, tickets } from "../../drizzle/ticketing-schema.js";
import { getTicketDb } from "../ticketDb.js";
import { kenyanPhoneVariants } from "../phone.js";

const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILED_ATTEMPTS = 5;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function sameSecret(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function clientKey(req: VercelRequest) {
  return headerValue(req.headers["x-forwarded-for"]).split(",")[0]?.trim() || "unknown";
}

function isRateLimited(key: string, now = Date.now()) {
  const state = failedAttempts.get(key);
  if (!state || state.resetAt <= now) {
    failedAttempts.delete(key);
    return false;
  }
  return state.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailure(key: string, now = Date.now()) {
  const state = failedAttempts.get(key);
  if (!state || state.resetAt <= now) {
    failedAttempts.set(key, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
    return;
  }
  state.count += 1;
}

async function eventTicketDetails(db: any, ticketId: string) {
  const details = await db
    .select({
      eventTitle: events.title,
      eventDate: events.eventDate,
      venue: events.venue,
      buyerName: eventTickets.buyerName,
      buyerEmail: eventTickets.buyerEmail,
      buyerPhone: eventTickets.buyerPhone,
      paymentReference: eventTickets.paystackRef,
      scannedAt: eventTickets.scannedAt,
    })
    .from(eventTickets)
    .leftJoin(events, eq(eventTickets.eventId, events.id))
    .where(eq(eventTickets.id, ticketId))
    .limit(1);
  const payment = await db
    .select({ amount: orders.totalAmount })
    .from(orders)
    .where(eq(orders.id, details[0]?.paymentReference || ""))
    .limit(1);
  return details[0] ? { ...details[0], amount: payment[0]?.amount || null } : null;
}

async function legacyTicketDetails(db: any, ticketId: string) {
  const details = await db
    .select({
      buyerEmail: orders.buyerEmail,
      paymentReference: orders.id,
      amount: orders.totalAmount,
      scannedAt: tickets.scannedAt,
    })
    .from(tickets)
    .leftJoin(orders, eq(tickets.orderId, orders.id))
    .where(eq(tickets.id, ticketId))
    .limit(1);
  return details[0] || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const expected = process.env.GATE_PIN_CODE || process.env.GATE_CHECKIN_PIN;
  const key = clientKey(req);
  if (isRateLimited(key)) {
    res.status(429).json({ valid: false, error: "Too many invalid gate PIN attempts" });
    return;
  }
  const provided = headerValue(req.headers["x-gate-pin"]);
  if (!expected || !sameSecret(provided, expected)) {
    recordFailure(key);
    res.status(401).json({ valid: false, error: "Invalid gate PIN" });
    return;
  }
  failedAttempts.delete(key);
  if (req.method === "GET") {
    const ticketId = String(req.query.ticketId || "").trim();
    const phone = String(req.query.phone || "").trim();
    const phoneVariants = kenyanPhoneVariants(phone);
    const db = getTicketDb();
    if (!db) {
      res.status(503).json({ valid: false, error: "Database unavailable" });
      return;
    }
    if (!ticketId && !phoneVariants.length) {
      res.status(400).json({ valid: false, error: "ticketId or phone is required" });
      return;
    }
    const eventQuery = ticketId
      ? db.select({ id: eventTickets.id, status: eventTickets.status, scannedAt: eventTickets.scannedAt }).from(eventTickets).where(and(eq(eventTickets.id, ticketId), eq(eventTickets.status, "valid"))).limit(1)
      : db.select({ id: eventTickets.id, status: eventTickets.status, scannedAt: eventTickets.scannedAt }).from(eventTickets).where(and(inArray(eventTickets.buyerPhone, phoneVariants), eq(eventTickets.status, "valid"))).limit(1);
    let eventTicket = (await eventQuery)[0];
    if (!eventTicket) {
      const usedQuery = ticketId
        ? db.select({ id: eventTickets.id, status: eventTickets.status, scannedAt: eventTickets.scannedAt }).from(eventTickets).where(and(eq(eventTickets.id, ticketId), eq(eventTickets.status, "used"))).limit(1)
        : db.select({ id: eventTickets.id, status: eventTickets.status, scannedAt: eventTickets.scannedAt }).from(eventTickets).where(and(inArray(eventTickets.buyerPhone, phoneVariants), eq(eventTickets.status, "used"))).orderBy(eventTickets.scannedAt).limit(1);
      eventTicket = (await usedQuery)[0];
    }
    if (eventTicket) {
      const ticket = await eventTicketDetails(db, eventTicket.id);
      if (eventTicket.status === "used") {
        res.status(409).json({ valid: false, status: "used", error: "Ticket has already been used", usedAt: eventTicket.scannedAt, ticketId: eventTicket.id, ticket });
        return;
      }
      res.status(200).json({ valid: true, status: "valid", ticketId: eventTicket.id, ticket });
      return;
    }
    if (ticketId) {
      const legacy = (await db.select({ status: tickets.status, scannedAt: tickets.scannedAt }).from(tickets).where(eq(tickets.id, ticketId)).limit(1))[0];
      if (legacy?.status === "used") {
        res.status(409).json({ valid: false, status: "used", error: "Ticket has already been used", usedAt: legacy.scannedAt, ticketId, ticket: await legacyTicketDetails(db, ticketId) });
        return;
      }
      if (legacy) {
        res.status(200).json({ valid: true, status: "valid", ticketId, ticket: await legacyTicketDetails(db, ticketId) });
        return;
      }
    }
    res.status(404).json({ valid: false, error: ticketId ? "Ticket not found" : "No ticket found for that phone number" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  if (body.confirm !== true) {
    res.status(400).json({ valid: false, error: "Ticket must be confirmed before entry is recorded" });
    return;
  }
  const ticketId = String(body.ticketId || "").trim();
  const phone = String(body.phone || "").trim();
  const phoneVariants = kenyanPhoneVariants(phone);
  const db = getTicketDb();
  if (!db) {
    res.status(503).json({ valid: false, error: "Database unavailable" });
    return;
  }
  if (!ticketId && phone) {
    const found = await db
      .select({ id: eventTickets.id, status: eventTickets.status, scannedAt: eventTickets.scannedAt })
      .from(eventTickets)
      .where(and(inArray(eventTickets.buyerPhone, phoneVariants), eq(eventTickets.status, "valid")))
      .limit(1);
    if (!found[0]) {
      const used = await db
        .select({ id: eventTickets.id, scannedAt: eventTickets.scannedAt })
        .from(eventTickets)
        .where(and(inArray(eventTickets.buyerPhone, phoneVariants), eq(eventTickets.status, "used")))
        .orderBy(eventTickets.scannedAt)
        .limit(1);
      if (!used[0]) {
        res.status(404).json({ valid: false, error: "No valid ticket found for that phone number" });
        return;
      }
      res.status(409).json({
        valid: false,
        status: "used",
        error: "Ticket has already been used",
        usedAt: used[0].scannedAt,
        ticketId: used[0].id,
        ticket: await eventTicketDetails(db, used[0].id),
      });
      return;
    }
    const updated = await db
      .update(eventTickets)
      .set({ status: "used", scannedAt: new Date().toISOString() })
      .where(and(eq(eventTickets.id, found[0].id), eq(eventTickets.status, "valid")))
      .returning({ id: eventTickets.id });
    if (!updated.length) {
      const used = await db
        .select({ id: eventTickets.id, scannedAt: eventTickets.scannedAt })
        .from(eventTickets)
        .where(and(inArray(eventTickets.buyerPhone, phoneVariants), eq(eventTickets.status, "used")))
        .orderBy(eventTickets.scannedAt)
        .limit(1);
      res.status(409).json({
        valid: false,
        status: "used",
        error: "Ticket has already been used",
        usedAt: used[0]?.scannedAt,
        ticketId: used[0]?.id,
        ticket: used[0] ? await eventTicketDetails(db, used[0].id) : null,
      });
      return;
    }
    res.status(200).json({ valid: true, ticketId: found[0].id, ticket: await eventTicketDetails(db, found[0].id) });
    return;
  }
  if (!ticketId) {
    res.status(400).json({ valid: false, error: "ticketId or phone is required" });
    return;
  }
  const eventUpdated = await db
    .update(eventTickets)
    .set({ status: "used", scannedAt: new Date().toISOString() })
    .where(and(eq(eventTickets.id, ticketId), eq(eventTickets.status, "valid")))
    .returning({ id: eventTickets.id });
  if (eventUpdated.length) {
    res.status(200).json({ valid: true, ticketId, ticket: await eventTicketDetails(db, ticketId) });
    return;
  }
  const existingEventTicket = await db
    .select({ status: eventTickets.status, scannedAt: eventTickets.scannedAt })
    .from(eventTickets)
    .where(eq(eventTickets.id, ticketId))
    .limit(1);
  if (existingEventTicket[0]?.status === "used") {
    res.status(409).json({ valid: false, status: "used", error: "Ticket has already been used", usedAt: existingEventTicket[0].scannedAt, ticketId, ticket: await eventTicketDetails(db, ticketId) });
    return;
  }
  const legacyUpdated = await db
    .update(tickets)
    .set({ status: "used", scannedAt: new Date().toISOString() })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, "valid")))
    .returning({ id: tickets.id });
  if (!legacyUpdated.length) {
    const legacy = await db
      .select({ status: tickets.status, scannedAt: tickets.scannedAt })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    if (legacy[0]?.status === "used") {
      res.status(409).json({ valid: false, status: "used", error: "Ticket has already been used", usedAt: legacy[0].scannedAt, ticketId, ticket: await legacyTicketDetails(db, ticketId) });
      return;
    }
    res.status(404).json({ valid: false, error: "Ticket not found" });
    return;
  }
  res.status(200).json({ valid: true, ticketId, ticket: await legacyTicketDetails(db, ticketId) });
}
