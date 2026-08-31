import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearAdminCookie } from "../_adminAuth";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  clearAdminCookie(res);
  res.status(200).json({ success: true });
}
