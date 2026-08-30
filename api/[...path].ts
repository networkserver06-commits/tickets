import express from "express";
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
