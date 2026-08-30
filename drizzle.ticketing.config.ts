import { defineConfig } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL or DATABASE_URL is required");

export default defineConfig({
  schema: "./drizzle/ticketing-schema.ts",
  out: "./drizzle/ticketing-migrations",
  dialect: "turso",
  dbCredentials: { url },
});
