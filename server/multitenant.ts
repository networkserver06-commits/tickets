import { eq } from "drizzle-orm";
import { clients, events, type InsertClient, type InsertEvent } from "../drizzle/ticketing-schema";
import { getTicketDb } from "./ticketDb";

export function validateSubaccountCode(value: string) {
  return /^ACCT_[A-Za-z0-9]+$/.test(value.trim());
}

export async function listClients() {
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  return db.select().from(clients);
}

export async function createClient(input: Omit<InsertClient, "createdAt">) {
  if (!validateSubaccountCode(input.paystackSubaccountCode)) throw new Error("Invalid Paystack subaccount code");
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  const record = { ...input, createdAt: new Date().toISOString() };
  await db.insert(clients).values(record);
  return record;
}

export async function updateClient(id: string, input: Partial<Omit<InsertClient, "id" | "createdAt">>) {
  if (input.paystackSubaccountCode && !validateSubaccountCode(input.paystackSubaccountCode)) throw new Error("Invalid Paystack subaccount code");
  const db = getTicketDb(); if (!db) throw new Error("Turso database is not configured");
  await db.update(clients).set(input).where(eq(clients.id, id));
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1); return rows[0];
}

export async function listEvents() {
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  return db.select().from(events);
}

export async function createEvent(input: Omit<InsertEvent, "createdAt">) {
  if (!validateSubaccountCode(input.paystackSubaccountCode)) throw new Error("Invalid Paystack subaccount code");
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  const client = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
  if (!client[0]) throw new Error("Client not found");
  const record = { ...input, createdAt: new Date().toISOString() };
  await db.insert(events).values(record);
  return record;
}
