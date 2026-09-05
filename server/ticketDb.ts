import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
import * as schema from "../drizzle/ticketing-schema.js";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let schemaPromise: Promise<boolean> | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY NOT NULL, buyer_email TEXT NOT NULL, total_amount INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'valid', FOREIGN KEY (order_id) REFERENCES orders(id))`,
  `CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY NOT NULL, business_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, paystack_subaccount_code TEXT NOT NULL, platform_fee_percentage INTEGER NOT NULL DEFAULT 10, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY NOT NULL, client_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, event_date TEXT, venue TEXT, image_url TEXT, ticket_price INTEGER NOT NULL, capacity INTEGER NOT NULL DEFAULT 500, sold_count INTEGER NOT NULL DEFAULT 0, paystack_subaccount_code TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES clients(id))`,
  `CREATE TABLE IF NOT EXISTS event_tickets (id TEXT PRIMARY KEY NOT NULL, event_id TEXT NOT NULL, buyer_name TEXT NOT NULL, buyer_email TEXT NOT NULL, buyer_phone TEXT NOT NULL, paystack_ref TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'valid', scanned_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (event_id) REFERENCES events(id))`,
  `CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS payment_attempts (reference TEXT PRIMARY KEY NOT NULL, provider TEXT NOT NULL, event_id TEXT NOT NULL, buyer_name TEXT NOT NULL, buyer_email TEXT NOT NULL, buyer_phone TEXT NOT NULL, quantity INTEGER NOT NULL, amount INTEGER NOT NULL, external_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', receipt TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (event_id) REFERENCES events(id))`,
];

export async function ensureTicketSchema() {
  if (schemaPromise) return schemaPromise;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return false;
  schemaPromise = (async () => {
    try {
      const client = createClient({
        url,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      for (const sql of schemaStatements) await client.execute(sql);
      try { await client.execute("ALTER TABLE tickets ADD COLUMN scanned_at TEXT"); } catch (error) {
        if (!String(error).toLowerCase().includes("duplicate column")) throw error;
      }
      try { await client.execute("ALTER TABLE events ADD COLUMN image_url TEXT"); } catch (error) {
        if (!String(error).toLowerCase().includes("duplicate column")) throw error;
      }
      return true;
    } catch (error) {
      schemaPromise = null;
      console.error("[Ticket DB] Schema initialization failed", error);
      return false;
    }
  })();
  return schemaPromise;
}

export function getTicketDb() {
  if (db) return db;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return null;
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  db = drizzle(client, { schema });
  return db;
}
