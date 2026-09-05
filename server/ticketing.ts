import * as crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import express from "express";
import type {
  Request,
  RequestHandler,
  Response,
} from "express-serve-static-core";

type ExpressApp = ReturnType<typeof express>;
import { nanoid } from "nanoid";
import {
  events,
  eventTickets,
  orders,
  tickets,
  paymentAttempts,
} from "../drizzle/ticketing-schema.js";
import { getTicketDb } from "./ticketDb.js";
import { normalizeKenyanPhone } from "./phone.js";
import { sendTicketConfirmation } from "./resend.js";
import { getMpesaProvider } from "./paymentSettings.js";

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

export function isAdminUser(user: { role?: string } | null | undefined) {
  return user?.role === "admin";
}

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
    customerName: String(
      input?.metadata?.customer_name || input?.customer?.first_name || "—"
    ),
  };
}

export function signatureMatches(
  rawBody: string,
  signature: string | undefined
) {
  const secret = getPaystackSecret();
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  const provided = Buffer.from(signature, "utf8");
  const actual = Buffer.from(expected, "utf8");
  return (
    provided.length === actual.length &&
    crypto.timingSafeEqual(provided, actual)
  );
}

type PaymentInput = {
  eventId: string;
  quantity: number;
  name: string;
  email: string;
  phone: string;
};

function paymentReference() {
  return `passage-${nanoid(24)}`;
}

function requestBaseUrl(req: Request) {
  const configured = process.env.VITE_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (configured?.trim()) return configured.trim().replace(/\/$/, "");
  const forwardedProto = req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  return `${forwardedProto || req.protocol}://${req.get("host") || "tickets.leetec.online"}`;
}

async function preparePayment(req: Request, dbFactory: () => any): Promise<{
  input: PaymentInput;
  reference: string;
  amount: number;
  event: { id: string; title: string; ticketPrice: number; capacity: number; soldCount: number; paystackSubaccountCode: string };
  metadata: Record<string, unknown>;
}> {
  const body = (req.body || {}) as Record<string, unknown>;
  const eventId = String(body.eventId || "").trim();
  const quantity = Number(body.quantity);
  const name = String(body.name || "").trim().slice(0, 200);
  const email = String(body.email || "").trim().slice(0, 320);
  const phone = normalizeKenyanPhone(String(body.phone || "").trim());
  if (!eventId || !Number.isInteger(quantity) || quantity < 1 || quantity > 8 || !name || !/^\S+@\S+\.\S+$/.test(email) || !/^254(?:1|7)\d{8}$/.test(phone)) {
    throw new Error("Event, quantity, name, email, and a valid Kenyan phone number are required");
  }
  const db = dbFactory();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select({
    id: events.id,
    title: events.title,
    ticketPrice: events.ticketPrice,
    capacity: events.capacity,
    soldCount: events.soldCount,
    paystackSubaccountCode: events.paystackSubaccountCode,
  }).from(events).where(eq(events.id, eventId)).limit(1);
  const event = rows[0];
  if (!event) throw new Error("Event not found");
  if (event.soldCount + quantity > event.capacity) throw new Error("The selected quantity is no longer available");
  const reference = paymentReference();
  const amount = event.ticketPrice * quantity;
  return {
    input: { eventId, quantity, name, email, phone },
    reference,
    amount,
    event,
    metadata: {
      eventId,
      eventTitle: event.title,
      quantity: String(quantity),
      full_name: name,
      phone,
      verificationBaseUrl: requestBaseUrl(req),
      custom_fields: [
        { display_name: "Full name", variable_name: "full_name", value: name },
        { display_name: "Phone", variable_name: "phone", value: phone },
        { display_name: "Quantity", variable_name: "quantity", value: String(quantity) },
        { display_name: "Event", variable_name: "event_id", value: eventId },
      ],
    },
  };
}

function getCourtesyConfig() {
  const baseUrl = (process.env.COURTNEY_BASE_URL || "https://courtneytech.xyz/api").trim().replace(/\/$/, "");
  const apiKey = process.env.COURTNEY_API_KEY?.trim();
  const apiSecret = process.env.COURTNEY_API_SECRET?.trim();
  const accountId = Number(process.env.COURTNEY_ACCOUNT_ID);
  if (!apiKey || !apiSecret || !baseUrl || !Number.isInteger(accountId) || accountId <= 0) return null;
  return { baseUrl, apiKey, apiSecret, accountId };
}

async function courtesyJson(path: string, init: RequestInit) {
  const config = getCourtesyConfig();
  if (!config) throw new Error("CourtesyTech is not configured");
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "X-API-Key": config.apiKey,
      "X-API-Secret": config.apiSecret,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as any;
  if (!response.ok || payload?.status === false || payload?.error) throw new Error(payload?.message || payload?.error || "CourtesyTech request failed");
  return payload;
}

async function paystackJson(path: string, init: RequestInit) {
  const secret = getPaystackSecret();
  if (!secret) throw new Error("Paystack secret key is not configured");
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as any;
  if (!response.ok || payload?.status === false) {
    throw new Error(payload?.message || "Paystack request failed");
  }
  return payload;
}

async function finalizeCourtesyPayment(attempt: any, receipt: string | null, dbFactory: () => any) {
  const payload = {
    event: "charge.success",
    data: {
      reference: attempt.reference,
      status: "success",
      amount: attempt.amount,
      currency: "KES",
      metadata: {
        eventId: attempt.eventId,
        quantity: String(attempt.quantity),
        full_name: attempt.buyerName,
        phone: attempt.buyerPhone,
      },
      customer: { email: attempt.buyerEmail },
      channel: "mobile_money",
      mpesaReceipt: receipt,
    },
  };
  await processWebhook(payload, dbFactory);
}

export function registerTicketingRoutes(
  app: ExpressApp,
  dbFactory: () => any = getTicketDb,
  adminMiddleware: RequestHandler = (_req, _res, next) => next()
) {
  app.get("/api/payments/config", async (_req: Request, res: Response) => {
    try {
      const provider = await getMpesaProvider(dbFactory());
      return res.status(200).json({ cardProvider: "paystack", mpesaProvider: provider });
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : "Unable to read payment configuration" });
    }
  });

  app.post("/api/payments/initialize", async (req: Request, res: Response) => {
    try {
      const secret = getPaystackSecret();
      if (!secret) return res.status(503).json({ error: "Paystack secret key is not configured" });
      const payment = await preparePayment(req, dbFactory);
      const payload = await paystackJson("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: payment.input.email,
          amount: String(payment.amount),
          currency: "KES",
          reference: payment.reference,
          callback_url: `${requestBaseUrl(req)}/ticket/${encodeURIComponent(payment.reference)}`,
          subaccount: payment.event.paystackSubaccountCode || undefined,
          metadata: payment.metadata,
        }),
      });
      return res.status(200).json({
        reference: payment.reference,
        authorizationUrl: payload.data?.authorization_url,
        accessCode: payload.data?.access_code,
        status: payload.data?.status || "initialized",
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to initialize card payment" });
    }
  });

  app.post("/api/payments/mpesa", async (req: Request, res: Response) => {
    try {
      const db = dbFactory();
      const provider = await getMpesaProvider(db);
      const payment = await preparePayment(req, dbFactory);
      if (provider === "paystack") {
        const payload = await paystackJson("/charge", {
          method: "POST",
          body: JSON.stringify({
            email: payment.input.email,
            amount: String(payment.amount),
            currency: "KES",
            reference: payment.reference,
            subaccount: payment.event.paystackSubaccountCode || undefined,
            metadata: payment.metadata,
            mobile_money: { phone: `+${payment.input.phone}`, provider: "mpesa" },
          }),
        });
        return res.status(200).json({ reference: payment.reference, provider, status: payload.data?.status || "pending", displayText: payload.data?.display_text || "Approve the M-Pesa prompt on your phone.", channel: "mobile_money" });
      }
      const courtesy = getCourtesyConfig();
      if (!courtesy) return res.status(503).json({ error: "CourtesyTech is not configured" });
      const courtesyReference = `p${nanoid(10)}`;
      const localPhone = `0${payment.input.phone.slice(3)}`;
      const payload = await courtesyJson("/v2/stkpush", {
        method: "POST",
        body: JSON.stringify({
          payment_account_id: courtesy.accountId,
          phone: localPhone,
          amount: Math.round(payment.amount / 100),
          reference: courtesyReference,
          description: `Ticket payment: ${payment.event.title}`.slice(0, 120),
          callback_url: `${requestBaseUrl(req)}/api/webhook/courtesytech`,
          success_callback_url: `${requestBaseUrl(req)}/api/webhook/courtesytech/success`,
          confirmation_url: `${requestBaseUrl(req)}/api/webhook/courtesytech/confirmation`,
        }),
      });
      const checkoutRequestId = String(payload.checkout_request_id || payload.data?.checkout_request_id || "").trim();
      if (!checkoutRequestId) throw new Error("CourtesyTech did not return a checkout request ID");
      await db.insert(paymentAttempts).values({ reference: payment.reference, provider: "courtesytech", eventId: payment.input.eventId, buyerName: payment.input.name, buyerEmail: payment.input.email, buyerPhone: payment.input.phone, quantity: payment.input.quantity, amount: payment.amount, externalId: checkoutRequestId, status: "pending" });
      return res.status(200).json({ reference: payment.reference, provider, checkoutRequestId, status: "pending", displayText: "Approve the M-Pesa prompt on your phone.", channel: "mobile_money" });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to start M-Pesa payment" });
    }
  });

  app.get("/api/payments/status", async (req: Request, res: Response) => {
    const reference = String(req.query.reference || "").trim();
    if (!/^passage-[A-Za-z0-9-]+$/.test(reference)) return res.status(400).json({ error: "Valid payment reference is required" });
    try {
      const db = dbFactory();
      const attempts = await db.select().from(paymentAttempts).where(eq(paymentAttempts.reference, reference)).limit(1);
      const attempt = attempts[0];
      const provider = attempt?.provider === "courtesytech" ? "courtesytech" : await getMpesaProvider(db);
      if (provider === "courtesytech") {
        if (!attempt) return res.status(404).json({ error: "Payment attempt not found" });
        const payload = await courtesyJson("/v2/status", { method: "POST", body: JSON.stringify({ checkout_request_id: attempt.externalId }) });
        const status = String(payload.status || payload.data?.status || "pending").toLowerCase();
        const receipt = String(payload.mpesaReceipt || payload.data?.mpesaReceipt || "").trim() || null;
        if (status === "completed" && attempt.status !== "completed") await finalizeCourtesyPayment(attempt, receipt, dbFactory);
        if (status === "completed") await db.update(paymentAttempts).set({ status: "completed", receipt: receipt || undefined }).where(eq(paymentAttempts.reference, reference));
        return res.status(200).json({ reference, provider, status, paid: status === "completed", receipt });
      }
      const payload = await paystackJson(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
      return res.status(200).json({ reference, provider, status: payload.data?.status || "unknown", paid: payload.data?.status === "success" });
    } catch (error) {
      return res.status(502).json({ error: error instanceof Error ? error.message : "Unable to check payment status" });
    }
  });

  const courtesyCallback = async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const checkoutRequestId = String(body.checkout_request_id || body.data && (body.data as Record<string, unknown>).checkout_request_id || "").trim();
      if (checkoutRequestId) {
        const db = dbFactory();
        const attempts = await db.select().from(paymentAttempts).where(eq(paymentAttempts.externalId, checkoutRequestId)).limit(1);
        const attempt = attempts[0];
        if (attempt) {
          const payload = await courtesyJson("/v2/status", { method: "POST", body: JSON.stringify({ checkout_request_id: checkoutRequestId }) });
          const status = String(payload.status || payload.data?.status || "pending").toLowerCase();
          if (status === "completed") await finalizeCourtesyPayment(attempt, String(payload.mpesaReceipt || payload.data?.mpesaReceipt || "") || null, dbFactory);
        }
      }
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("[CourtesyTech callback]", error);
      return res.status(200).json({ received: true });
    }
  };
  app.post("/api/webhook/courtesytech", courtesyCallback);
  app.post("/api/webhook/courtesytech/success", courtesyCallback);
  app.post("/api/webhook/courtesytech/confirmation", courtesyCallback);

  app.post("/api/webhook/paystack", (req: Request, res: Response) => {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : JSON.stringify(req.body ?? {});
    if (!signatureMatches(rawBody, req.header("x-paystack-signature")))
      return res.status(401).json({ error: "Invalid signature" });
    let payload: unknown;
    try {
      payload = Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
    void processWebhook(payload, dbFactory)
      .then(() => res.status(200).json({ received: true }))
      .catch(error => {
        console.error("[Paystack webhook]", error);
        res.status(500).json({ error: "Unable to persist webhook" });
      });
  });

  app.get("/api/tickets/:ticketId", async (req: Request, res: Response) => {
    const ticketId =
      typeof req.params.ticketId === "string" ? req.params.ticketId.trim() : "";
    if (!ticketId)
      return res.status(400).json({ error: "ticketId is required" });
    const db = dbFactory();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const result = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        orderId: tickets.orderId,
        buyerEmail: orders.buyerEmail,
      })
      .from(tickets)
      .leftJoin(orders, eq(tickets.orderId, orders.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);
    const eventResult = await db
      .select({
        id: eventTickets.id,
        status: eventTickets.status,
        buyerName: eventTickets.buyerName,
        buyerEmail: eventTickets.buyerEmail,
        buyerPhone: eventTickets.buyerPhone,
        paystackRef: eventTickets.paystackRef,
        eventId: events.id,
        eventTitle: events.title,
        eventDate: events.eventDate,
        venue: events.venue,
      })
      .from(eventTickets)
      .leftJoin(events, eq(eventTickets.eventId, events.id))
      .where(eq(eventTickets.id, ticketId))
      .limit(1);
    const referenceResult =
      result[0] || eventResult[0]
        ? []
        : await db
            .select({
              id: eventTickets.id,
              status: eventTickets.status,
              buyerName: eventTickets.buyerName,
              buyerEmail: eventTickets.buyerEmail,
              buyerPhone: eventTickets.buyerPhone,
              paystackRef: eventTickets.paystackRef,
              eventId: events.id,
              eventTitle: events.title,
              eventDate: events.eventDate,
              venue: events.venue,
            })
            .from(eventTickets)
            .leftJoin(events, eq(eventTickets.eventId, events.id))
              .where(eq(eventTickets.paystackRef, ticketId));
    let ticketRows = result[0] ? result : eventResult[0] ? eventResult : referenceResult;
    const ticket = ticketRows[0];
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    const publicTickets = (ticketRows as Array<Record<string, unknown>>).map(row => ({
      id: row.id,
      status: row.status,
      buyerName: "buyerName" in row ? row.buyerName : undefined,
      eventId: "eventId" in row ? row.eventId : undefined,
      eventTitle: "eventTitle" in row ? row.eventTitle : undefined,
      eventDate: "eventDate" in row ? row.eventDate : undefined,
      venue: "venue" in row ? row.venue : undefined,
    }));
    return res.json({ ticket: publicTickets[0], tickets: publicTickets });
  });

  app.post(
    "/api/tickets/verify",
    adminMiddleware,
    async (req: Request, res: Response) => {
      const ticketId =
        typeof req.body?.ticketId === "string" ? req.body.ticketId.trim() : "";
      if (!ticketId)
        return res
          .status(400)
          .json({ valid: false, error: "ticketId is required" });
      const db = dbFactory();
      if (!db)
        return res
          .status(503)
          .json({ valid: false, error: "Database unavailable" });
      const legacy = await db
        .select({ id: tickets.id, status: tickets.status })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      if (legacy[0]) {
        if (legacy[0].status === "used")
          return res.status(409).json({
            valid: false,
            status: "used",
            error: "Ticket has already been used",
          });
        const updated = await db
          .update(tickets)
          .set({ status: "used", scannedAt: new Date().toISOString() })
          .where(and(eq(tickets.id, ticketId), eq(tickets.status, "valid")))
          .returning({ id: tickets.id });
        if (!updated.length)
          return res.status(409).json({
            valid: false,
            status: "used",
            error: "Ticket has already been used",
          });
        return res.json({ valid: true, status: "used", ticketId });
      }
      const eventTicket = await db
        .select({ id: eventTickets.id, status: eventTickets.status })
        .from(eventTickets)
        .where(eq(eventTickets.id, ticketId))
        .limit(1);
      if (!eventTicket[0])
        return res
          .status(404)
          .json({ valid: false, error: "Ticket not found" });
      if (eventTicket[0].status === "used")
        return res.status(409).json({
          valid: false,
          status: "used",
          error: "Ticket has already been used",
        });
      const updated = await db
        .update(eventTickets)
        .set({ status: "used", scannedAt: new Date().toISOString() })
        .where(
          and(eq(eventTickets.id, ticketId), eq(eventTickets.status, "valid"))
        )
        .returning({ id: eventTickets.id });
      if (!updated.length)
        return res.status(409).json({
          valid: false,
          status: "used",
          error: "Ticket has already been used",
        });
      return res.json({ valid: true, status: "used", ticketId });
    }
  );

  app.get("/api/paystack/transactions", adminMiddleware, async (req: Request, res: Response) => {
    const secret = getPaystackSecret();
    if (!secret)
      return res
        .status(503)
        .json({ error: "Paystack secret key is not configured" });
    const page = Math.max(1, Math.min(100, Number(req.query.page || 1)));
    const perPage = Math.max(1, Math.min(50, Number(req.query.perPage || 20)));
    try {
      const response = await fetch(
        `https://api.paystack.co/transaction?perPage=${perPage}&page=${page}`,
        { headers: { Authorization: `Bearer ${secret}` } }
      );
      const payload = (await response.json()) as any;
      if (!response.ok || payload?.status === false)
        return res.status(502).json({
          error: payload?.message || "Unable to retrieve Paystack transactions",
        });
      return res.json({
        transactions: Array.isArray(payload?.data)
          ? payload.data.map(normalizePaystackTransaction)
          : [],
        meta: payload?.meta || { page, perPage, total: 0 },
      });
    } catch (error) {
      console.error("[Paystack transactions]", error);
      return res
        .status(502)
        .json({ error: "Unable to retrieve Paystack transactions" });
    }
  });

  app.get("/api/dashboard/summary", adminMiddleware, async (_req, res) => {
    res.set("Cache-Control", "no-store, max-age=0");
    const db = dbFactory();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Dashboard query timed out")), 8000);
    });
    try {
      const [orderRows, ticketRows, eventTicketRows, eventRows] = await Promise.race([
        Promise.all([
          db.select().from(orders).orderBy(desc(orders.createdAt)),
          db.select().from(tickets),
          db.select({
            id: eventTickets.id,
            orderId: eventTickets.paystackRef,
            status: eventTickets.status,
            scannedAt: eventTickets.scannedAt,
            createdAt: eventTickets.createdAt,
            eventId: eventTickets.eventId,
            eventTitle: events.title,
            buyerName: eventTickets.buyerName,
            buyerPhone: eventTickets.buyerPhone,
          }).from(eventTickets).leftJoin(events, eq(eventTickets.eventId, events.id)),
          db.select({ id: events.id, title: events.title }).from(events),
        ]),
        timeout,
      ]);
      return res.json({ orders: orderRows, tickets: [...ticketRows, ...eventTicketRows], events: eventRows });
    } catch (error) {
      console.error("[Dashboard summary]", error);
      return res
        .status(503)
        .json({ error: "Dashboard data temporarily unavailable" });
    }
  });

  app.delete?.("/api/dashboard/orders/:id", adminMiddleware, async (req, res) => {
    const db = dbFactory();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const id = String(req.params.id || "");
    try {
      const deleted = await db.transaction(async (tx: any) => {
        const order = (await tx.select().from(orders).where(eq(orders.id, id)).limit(1))[0];
        if (!order) return null;
        const legacyTickets = await tx.select().from(tickets).where(eq(tickets.orderId, id));
        const eventTicketRows = await tx.select().from(eventTickets).where(eq(eventTickets.paystackRef, id));
        await tx.delete(tickets).where(eq(tickets.orderId, id));
        await tx.delete(eventTickets).where(eq(eventTickets.paystackRef, id));
        await tx.delete(orders).where(eq(orders.id, id));
        return { order, legacyTickets, eventTickets: eventTicketRows };
      });
      if (!deleted) return res.status(404).json({ error: "Order not found" });
      return res.json({ deleted });
    } catch (error) {
      console.error("[Dashboard delete order]", error);
      return res.status(500).json({ error: "Unable to delete order" });
    }
  });

  app.delete?.("/api/dashboard/tickets/:id", adminMiddleware, async (req, res) => {
    const db = dbFactory();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const id = String(req.params.id || "");
    try {
      const eventTicket = (await db.select().from(eventTickets).where(eq(eventTickets.id, id)).limit(1))[0];
      if (eventTicket) {
        await db.delete(eventTickets).where(eq(eventTickets.id, id));
        return res.json({ deleted: { kind: "eventTicket", eventTicket } });
      }
      const legacyTicket = (await db.select().from(tickets).where(eq(tickets.id, id)).limit(1))[0];
      if (!legacyTicket) return res.status(404).json({ error: "Ticket not found" });
      await db.delete(tickets).where(eq(tickets.id, id));
      return res.json({ deleted: { kind: "legacyTicket", legacyTicket } });
    } catch (error) {
      console.error("[Dashboard delete ticket]", error);
      return res.status(500).json({ error: "Unable to delete ticket" });
    }
  });

  app.post("/api/dashboard/restore", adminMiddleware, async (req, res) => {
    const db = dbFactory();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const deleted = req.body?.deleted;
    try {
      await db.transaction(async (tx: any) => {
        if (deleted?.order) {
          await tx.insert(orders).values(deleted.order);
          if (deleted.legacyTickets?.length) await tx.insert(tickets).values(deleted.legacyTickets);
          if (deleted.eventTickets?.length) await tx.insert(eventTickets).values(deleted.eventTickets);
        } else if (deleted?.kind === "eventTicket") await tx.insert(eventTickets).values(deleted.eventTicket);
        else if (deleted?.kind === "legacyTicket") await tx.insert(tickets).values(deleted.legacyTicket);
        else throw new Error("Invalid restore payload");
      });
      return res.json({ restored: true });
    } catch (error) {
      console.error("[Dashboard restore]", error);
      return res.status(500).json({ error: "Unable to undo deletion" });
    }
  });
}

async function processWebhook(
  payload: any,
  dbFactory: () => any = getTicketDb
) {
  if (
    payload?.event !== "charge.success" ||
    payload?.data?.status !== "success"
  )
    return;
  const db = dbFactory();
  if (!db) throw new Error("Database unavailable");
  const reference = String(
    payload.data.reference || payload.data.id || nanoid(12)
  );
  const existing = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.id, reference))
    .limit(1);
  if (existing.length) return;
  const metadata = payload.data.metadata || {};
  const quantity = Number(metadata.quantity || payload.data.quantity || 1);
  const eventId =
    typeof metadata.eventId === "string" ? metadata.eventId.trim() : "";
  const amount = Number(payload.data.amount || 0);
  if (
    String(payload.data.currency || "KES").toUpperCase() !== "KES" ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 8 ||
    !Number.isInteger(amount) ||
    amount <= 0
  )
    throw new Error("Invalid payment quantity or amount");
  const buyerName = String(
    metadata.full_name || payload.data.customer?.name || "Ticket buyer"
  )
    .trim()
    .slice(0, 200);
  const buyerPhone = normalizeKenyanPhone(metadata.phone);
  const buyerEmail = String(
    payload.data.customer?.email || "unknown@example.com"
  )
    .trim()
    .slice(0, 320);
  let eventTitle: string | undefined;
  let eventDate: string | null | undefined;
  let venue: string | null | undefined;
  const createdTicketIds: string[] = [];
  await db.transaction(async (tx: any) => {
    let matchingEvent:
      | { id: string; title: string; ticketPrice: number }
      | undefined;
    if (eventId) {
      const rows = await tx
        .select({
          id: events.id,
          title: events.title,
          ticketPrice: events.ticketPrice,
        })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
          matchingEvent = rows[0];
      if (!matchingEvent) throw new Error("Event not found");
      if (amount !== matchingEvent.ticketPrice * quantity)
        throw new Error("Payment amount does not match event price");
      eventTitle = matchingEvent.title;
      const eventDetails = await tx.select({ eventDate: events.eventDate, venue: events.venue }).from(events).where(eq(events.id, eventId)).limit(1);
      eventDate = eventDetails[0]?.eventDate;
      venue = eventDetails[0]?.venue;
    }
    await tx.insert(orders).values({
      id: reference,
      buyerEmail,
      totalAmount: amount,
      createdAt: new Date(),
    });
    if (!matchingEvent) {
      const legacyTicketIds = Array.from({ length: quantity }, () => `tkt_${nanoid(16)}`);
      createdTicketIds.push(...legacyTicketIds);
      await tx.insert(tickets).values(
        legacyTicketIds.map(id => ({
          id,
          orderId: reference,
          status: "valid" as const,
        }))
      );
    }
    if (matchingEvent) {
      const reserved = await tx
        .update(events)
        .set({ soldCount: sql`${events.soldCount} + ${quantity}` })
        .where(
          and(
            eq(events.id, eventId),
            sql`${events.soldCount} + ${quantity} <= ${events.capacity}`
          )
        )
        .returning({ id: events.id });
      if (!reserved.length) throw new Error("Event is sold out");
      const eventTicketIds = Array.from({ length: quantity }, () => `evt_tkt_${nanoid(16)}`);
      createdTicketIds.splice(0, createdTicketIds.length, ...eventTicketIds);
      await tx.insert(eventTickets).values(
        eventTicketIds.map(id => ({
          id,
          eventId,
          buyerName,
          buyerEmail,
          buyerPhone,
          paystackRef: reference,
          status: "valid" as const,
        }))
      );
    }
  });
  try {
    await sendTicketConfirmation({
      to: buyerEmail,
      buyerName,
      buyerPhone,
      reference,
      eventTitle,
      eventDate,
      venue,
      quantity,
      amount,
      ticketIds: createdTicketIds,
    });
  } catch (error) {
    console.error("[Resend confirmation]", error);
  }
}

export async function getDashboardData() {
  const db = getTicketDb();
  if (!db) return { orders: [], tickets: [] };
  const [orderRows, ticketRows, eventTicketRows] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(tickets),
    db.select({
      id: eventTickets.id,
      orderId: eventTickets.paystackRef,
      status: eventTickets.status,
      scannedAt: eventTickets.scannedAt,
    }).from(eventTickets),
  ]);
  return {
    orders: orderRows,
    tickets: [
      ...ticketRows,
      ...eventTicketRows,
    ],
  };
}
