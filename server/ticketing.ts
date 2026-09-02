import * as crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Express, Request, RequestHandler, Response } from "express";
import { nanoid } from "nanoid";
import { events, eventTickets, orders, tickets } from "../drizzle/ticketing-schema.js";
import { getTicketDb } from "./ticketDb.js";
import { sdk } from "./_core/sdk";
import { sendTicketConfirmation } from "./resend";

const getPaystackSecret = () => process.env.PAYSTACK_SECRET_KEY;

export type PaystackTransaction = {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  channel: string;
  paidAt: string | null;
  createdAt: string | null;
  customerEmail: string;
  customerName: string;
};

export function isAdminUser(user: { role?: string } | null | undefined) { return user?.role === "admin"; }

export function normalizePaystackTransaction(input: any): PaystackTransaction {
  return {
    id: Number(input?.id || 0),
    reference: String(input?.reference || "—"),
    amount: Number(input?.amount || 0),
    currency: String(input?.currency || "KES"),
    status: String(input?.status || "unknown").toLowerCase(),
    channel: String(input?.channel || "—"),
    paidAt: input?.paid_at ? String(input.paid_at) : null,
    createdAt: input?.created_at ? String(input.created_at) : null,
    customerEmail: String(input?.customer?.email || input?.email || "—"),
    customerName: String(input?.metadata?.customer_name || input?.customer?.first_name || "—"),
  };
}

export function signatureMatches(rawBody: string, signature: string | undefined) {
  const secret = getPaystackSecret();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const provided = Buffer.from(signature, "utf8");
  const actual = Buffer.from(expected, "utf8");
  return provided.length === actual.length && crypto.timingSafeEqual(provided, actual);
}

export function registerTicketingRoutes(app: Express, dbFactory: () => any = getTicketDb, adminMiddleware: RequestHandler = (_req, _res, next) => next()) {
  app.post("/api/webhook/paystack", (req: Request, res: Response) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body ?? {});
    if (!signatureMatches(rawBody, req.header("x-paystack-signature"))) return res.status(401).json({ error: "Invalid signature" });
    let payload: unknown;
    try { payload = Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body; } catch { return res.status(400).json({ error: "Invalid JSON" }); }
    void processWebhook(payload, dbFactory).then(() => res.status(200).json({ received: true })).catch(error => {
      console.error("[Paystack webhook]", error);
      res.status(500).json({ error: "Unable to persist webhook" });
    });
  });

  app.get("/api/tickets/:ticketId", async (req: Request, res: Response) => {
    const ticketId = typeof req.params.ticketId === "string" ? req.params.ticketId.trim() : "";
    if (!ticketId) return res.status(400).json({ error: "ticketId is required" });
    const db = dbFactory();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const result = await db.select({ id: tickets.id, status: tickets.status, orderId: tickets.orderId, buyerEmail: orders.buyerEmail }).from(tickets).leftJoin(orders, eq(tickets.orderId, orders.id)).where(eq(tickets.id, ticketId)).limit(1);
    const ticket = result[0];
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    return res.json({ ticket });
  });

  app.post("/api/tickets/verify", adminMiddleware, async (req: Request, res: Response) => {
    const ticketId = typeof req.body?.ticketId === "string" ? req.body.ticketId.trim() : "";
    if (!ticketId) return res.status(400).json({ valid: false, error: "ticketId is required" });
    const db = dbFactory();
    if (!db) return res.status(503).json({ valid: false, error: "Database unavailable" });
    const existing = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
    const ticket = existing[0];
    if (!ticket) return res.status(404).json({ valid: false, error: "Ticket not found" });
    if (ticket.status === "used") return res.status(409).json({ valid: false, status: "used", error: "Ticket has already been used" });
    const updated = await db.update(tickets).set({ status: "used" }).where(and(eq(tickets.id, ticketId), eq(tickets.status, "valid"))).returning({ id: tickets.id });
    if (updated.length === 0) return res.status(409).json({ valid: false, status: "used", error: "Ticket has already been used" });
    return res.json({ valid: true, status: "used", ticketId });
  });

  app.get("/api/paystack/transactions", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    if (!isAdminUser(user)) return res.status(403).json({ error: "Admin role required" });
    const secret = getPaystackSecret();
    if (!secret) return res.status(503).json({ error: "Paystack secret key is not configured" });
    const page = Math.max(1, Math.min(100, Number(req.query.page || 1)));
    const perPage = Math.max(1, Math.min(50, Number(req.query.perPage || 20)));
    try {
      const response = await fetch(`https://api.paystack.co/transaction?perPage=${perPage}&page=${page}`, { headers: { Authorization: `Bearer ${secret}` } });
      const payload = await response.json() as any;
      if (!response.ok || payload?.status === false) return res.status(502).json({ error: payload?.message || "Unable to retrieve Paystack transactions" });
      return res.json({ transactions: Array.isArray(payload?.data) ? payload.data.map(normalizePaystackTransaction) : [], meta: payload?.meta || { page, perPage, total: 0 } });
    } catch (error) {
      console.error("[Paystack transactions]", error);
      return res.status(502).json({ error: "Unable to retrieve Paystack transactions" });
    }
  });

  app.get("/api/dashboard/summary", adminMiddleware, async (_req, res) => {
    const db = dbFactory();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const [orderRows, ticketRows] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(20),
      db.select().from(tickets).orderBy(desc(tickets.id)).limit(100),
    ]);
    return res.json({ orders: orderRows, tickets: ticketRows });
  });
}

async function processWebhook(payload: any, dbFactory: () => any = getTicketDb) {
  if (payload?.event !== "charge.success" || payload?.data?.status !== "success") return;
  const db = dbFactory();
  if (!db) throw new Error("Database unavailable");
  const reference = String(payload.data.reference || payload.data.id || nanoid(12));
  const existing = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, reference)).limit(1);
  if (existing.length) return;
  const metadata = payload.data.metadata || {};
  const quantity = Math.max(1, Number(metadata.quantity || payload.data.quantity || 1));
  const eventId = typeof metadata.eventId === "string" ? metadata.eventId : "";
  const buyerName = String(metadata.full_name || payload.data.customer?.name || "Ticket buyer");
  const buyerPhone = String(metadata.phone || "");
  const buyerEmail = String(payload.data.customer?.email || "unknown@example.com");
  let eventTitle: string | undefined;
  await db.transaction(async (tx: any) => {
    await tx.insert(orders).values({ id: reference, buyerEmail, totalAmount: Number(payload.data.amount || 0), createdAt: new Date() });
    await tx.insert(tickets).values(Array.from({ length: quantity }, () => ({ id: `tkt_${nanoid(16)}`, orderId: reference, status: "valid" as const })));
    if (eventId) {
      const matchingEvent = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
      if (matchingEvent[0]) { eventTitle = String(metadata.eventTitle || ""); await tx.insert(eventTickets).values(Array.from({ length: quantity }, () => ({ id: `evt_tkt_${nanoid(16)}`, eventId, buyerName, buyerEmail, buyerPhone, paystackRef: `${reference}-${nanoid(8)}`, status: "valid" as const }))); }
    }
  });
  try { await sendTicketConfirmation({ to: buyerEmail, buyerName, reference, eventTitle }); } catch (error) { console.error("[Resend confirmation]", error); }
}

export async function getDashboardData() {
  const db = getTicketDb();
  if (!db) return { orders: [], tickets: [] };
  const [orderRows, ticketRows] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(20),
    db.select().from(tickets).limit(100),
  ]);
  return { orders: orderRows, tickets: ticketRows };
}
