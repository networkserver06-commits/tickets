import { eq, or } from "drizzle-orm";
import {
  clients,
  events,
  type InsertClient,
  type InsertEvent,
} from "../drizzle/ticketing-schema.js";
import { getTicketDb } from "./ticketDb.js";

export function validateSubaccountCode(value: string) {
  return /^ACCT_[A-Za-z0-9]+$/.test(value.trim());
}

export async function listClients() {
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  const rows = await db.select().from(clients);
  const unique = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = row.paystackSubaccountCode.trim().toLowerCase() || row.email.trim().toLowerCase();
    if (!unique.has(key)) unique.set(key, row);
  }
  return Array.from(unique.values());
}

export async function createClient(input: Omit<InsertClient, "createdAt">) {
  if (!validateSubaccountCode(input.paystackSubaccountCode))
    throw new Error("Invalid Paystack subaccount code");
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  const existing = await db
    .select()
    .from(clients)
    .where(or(eq(clients.email, input.email), eq(clients.paystackSubaccountCode, input.paystackSubaccountCode)))
    .limit(1);
  if (existing[0]) return existing[0];
  const record = { ...input, createdAt: new Date().toISOString() };
  await db.insert(clients).values(record);
  return record;
}

export async function deleteClient(id: string) {
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  const linkedEvents = await db.select({ id: events.id }).from(events).where(eq(events.clientId, id)).limit(1);
  if (linkedEvents[0]) throw new Error("This payout profile is linked to an event and cannot be deleted until that event is removed or reassigned");
  await db.delete(clients).where(eq(clients.id, id));
  return { id };
}

export async function updateClient(
  id: string,
  input: Partial<Omit<InsertClient, "id" | "createdAt">>
) {
  if (input.businessName !== undefined && !input.businessName.trim()) throw new Error("Business name is required");
  if (input.email !== undefined && !input.email.trim()) throw new Error("Email is required");
  if (input.phone !== undefined && !input.phone.trim()) throw new Error("Phone is required");
  if (input.platformFeePercentage !== undefined && (!Number.isInteger(input.platformFeePercentage) || input.platformFeePercentage < 0 || input.platformFeePercentage > 100))
    throw new Error("Platform fee must be a whole number from 0 to 100");
  if (
    input.paystackSubaccountCode &&
    !validateSubaccountCode(input.paystackSubaccountCode)
  )
    throw new Error("Invalid Paystack subaccount code");
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  await db.update(clients).set(input).where(eq(clients.id, id));
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  return rows[0];
}

export async function listEvents() {
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  return db.select().from(events);
}

export async function updateEvent(id: string, input: Partial<Omit<InsertEvent, "id" | "createdAt">>) {
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  if (input.title !== undefined && !input.title.trim()) throw new Error("Event title is required");
  if (input.ticketPrice !== undefined && (!Number.isInteger(input.ticketPrice) || input.ticketPrice <= 0)) throw new Error("Ticket price must be a positive whole number");
  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity <= 0)) throw new Error("Capacity must be a positive whole number");
  if (input.paystackSubaccountCode && !validateSubaccountCode(input.paystackSubaccountCode)) throw new Error("Invalid Paystack subaccount code");
  const current = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!current[0]) throw new Error("Event not found");
  if (input.capacity !== undefined && input.capacity < current[0].soldCount)
    throw new Error(`Capacity cannot be below sold tickets (${current[0].soldCount})`);
  await db.update(events).set(input).where(eq(events.id, id));
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0];
}

export async function deleteEvent(id: string) {
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  await db.delete(events).where(eq(events.id, id));
  return { id };
}

export async function createEvent(input: Omit<InsertEvent, "createdAt">) {
  if (!validateSubaccountCode(input.paystackSubaccountCode))
    throw new Error("Invalid Paystack subaccount code");
  const db = getTicketDb();
  if (!db) throw new Error("Turso database is not configured");
  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);
  if (!client[0]) throw new Error("Client not found");
  const existing = await db.select().from(events).where(eq(events.id, input.id)).limit(1);
  if (existing[0]) return existing[0];
  const record = { ...input, createdAt: new Date().toISOString() };
  await db.insert(events).values(record);
  return record;
}
