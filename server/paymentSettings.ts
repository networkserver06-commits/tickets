import { eq } from "drizzle-orm";
import { appSettings } from "../drizzle/ticketing-schema.js";
import { getTicketDb } from "./ticketDb.js";

export type MpesaProvider = "paystack" | "courtesytech";
export const MPESA_PROVIDER_SETTING = "mpesa_provider";

export function isMpesaProvider(value: unknown): value is MpesaProvider {
  return value === "paystack" || value === "courtesytech";
}

export async function getMpesaProvider(db = getTicketDb()): Promise<MpesaProvider> {
  const fallback = isMpesaProvider(process.env.MPESA_PROVIDER) ? process.env.MPESA_PROVIDER : "paystack";
  if (!db) return fallback;
  const rows = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, MPESA_PROVIDER_SETTING)).limit(1);
  return isMpesaProvider(rows[0]?.value) ? rows[0].value : fallback;
}

export async function setMpesaProvider(provider: MpesaProvider, db = getTicketDb()) {
  if (!db) throw new Error("Database unavailable");
  const now = new Date().toISOString();
  await db.insert(appSettings).values({ key: MPESA_PROVIDER_SETTING, value: provider, updatedAt: now }).onConflictDoUpdate({ target: appSettings.key, set: { value: provider, updatedAt: now } });
  return provider;
}
