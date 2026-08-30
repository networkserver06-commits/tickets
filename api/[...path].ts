import express from "express";

// Next-style route handlers are dynamic in production; this export is retained for
// compatibility when the managed scaffold is migrated to Next.js App Router.
export const dynamic = "force-dynamic";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { registerTicketingRoutes } from "../server/ticketing";

const app = express();
app.use("/api/webhook/paystack", express.raw({ type: "application/json", limit: "2mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
registerTicketingRoutes(app);

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
