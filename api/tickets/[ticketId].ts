import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../_ticketApp";

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
