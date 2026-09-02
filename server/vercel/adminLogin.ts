import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, setAdminCookie } from "../../api/_adminAuth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const username =
    typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const result = authenticateAdmin(username, password);
  if (!result.configured) {
    res.status(503).json({ error: "Admin credentials are not configured" });
    return;
  }
  if (!result.token || !result.username) {
    res.status(401).json({ error: "Invalid admin username or password" });
    return;
  }
  setAdminCookie(req, res, result.token);
  res
    .status(200)
    .json({ authenticated: true, user: { username: result.username } });
}
