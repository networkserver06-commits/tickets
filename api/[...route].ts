import type { VercelRequest, VercelResponse } from "@vercel/node";
import adminLogin from "../server/vercel/adminLogin.js";
import adminLogout from "../server/vercel/adminLogout.js";
import adminSession from "../server/vercel/adminSession.js";
import appTicketing from "./_ticketApp.js";
import appOAuth from "./_oauthApp.js";
import appTrpc from "./_trpcApp.js";
import eventById from "../server/vercel/eventById.js";
import gateCheckin from "../server/vercel/gateCheckin.js";
import managementClients from "../server/vercel/managementClients.js";
import managementEvents from "../server/vercel/managementEvents.js";
import managementSubaccounts from "../server/vercel/managementSubaccounts.js";

function pathname(req: VercelRequest) {
  return new URL(req.url || "/", `https://${req.headers.host || "localhost"}`)
    .pathname;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const path = pathname(req);

  if (path.startsWith("/api/trpc/")) return appTrpc(req, res);
  if (path === "/api/oauth/callback") return appOAuth(req, res);
  if (
    path === "/api/webhook/paystack" ||
    path === "/api/dashboard/summary" ||
    path === "/api/tickets/verify" ||
    path.startsWith("/api/tickets/")
  )
    return appTicketing(req, res);

  if (path === "/api/admin/login") return adminLogin(req, res);
  if (path === "/api/admin/logout") return adminLogout(req, res);
  if (path === "/api/admin/session") return adminSession(req, res);
  if (path === "/api/gate/checkin") return gateCheckin(req, res);
  if (path === "/api/management/clients") return managementClients(req, res);
  if (path === "/api/management/events") return managementEvents(req, res);
  if (path === "/api/management/subaccounts")
    return managementSubaccounts(req, res);

  const eventMatch = path.match(/^\/api\/events\/([^/]+)$/);
  if (eventMatch) {
    req.query.id = decodeURIComponent(eventMatch[1]);
    return eventById(req, res);
  }

  res.status(404).json({ error: "API route not found" });
}
