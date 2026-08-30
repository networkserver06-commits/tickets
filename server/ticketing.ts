import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { nanoid } from "nanoid";
import { orders, tickets } from "../drizzle/ticketing-schema";
import { getTicketDb } from "./ticketDb";

const getPaystackSecret = () => process.env.PAYSTACK_SECRET_KEY;

export function signatureMatches(rawBody: string, signature: string | undefined) {
  const secret = getPaystackSecret();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const provided = Buffer.from(signature, "utf8");
  const actual = Buffer.from(expected, "utf8");
  return provided.length === actual.length && crypto.timingSafeEqual(provided, actual);
}

export function registerTicketingRoutes(app: Express, dbFactory: () => any = getTicketDb) {
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

  app.post("/api/tickets/verify", async (req: Request, res: Response) => {
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

  app.get("/api/dashboard/summary", async (_req, res) => {
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
  const quantity = Math.max(1, Number(payload.data.metadata?.quantity || payload.data.quantity || 1));
  await db.transaction(async (tx: any) => {
    await tx.insert(orders).values({ id: reference, buyerEmail: String(payload.data.customer?.email || "unknown@example.com"), totalAmount: Number(payload.data.amount || 0), createdAt: new Date() });
    await tx.insert(tickets).values(Array.from({ length: quantity }, () => ({ id: `tkt_${nanoid(16)}`, orderId: reference, status: "valid" as const })));
  });
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
