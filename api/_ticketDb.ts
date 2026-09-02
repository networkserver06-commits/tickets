import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
import * as schema from "./_ticketingSchema.js";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getTicketDb() {
  if (db) return db;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return null;
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  db = drizzle(client, { schema });
  return db;
}
