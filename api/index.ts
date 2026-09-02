import type { VercelRequest, VercelResponse } from "@vercel/node";

function pathname(req: VercelRequest) {
  return new URL(req.url || "/", `https://${req.headers.host || "localhost"}`)
    .pathname;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = pathname(req);

  if (path.startsWith("/api/trpc/")) {
    const { default: app } = await import("./_trpcApp.js");
    return app(req, res);
  }
  if (path === "/api/oauth/callback") {
    const { default: app } = await import("./_oauthApp.js");
    return app(req, res);
  }
  if (
    path === "/api/webhook/paystack" ||
    path === "/api/dashboard/summary" ||
    path === "/api/tickets/verify" ||
    path.startsWith("/api/tickets/")
  ) {
    const { default: app } = await import("./_ticketApp.js");
    return app(req, res);
  }
  if (path === "/api/admin/login") {
    const { default: route } = await import("../server/vercel/adminLogin.js");
    return route(req, res);
  }
  if (path === "/api/admin/logout") {
    const { default: route } = await import("../server/vercel/adminLogout.js");
    return route(req, res);
  }
  if (path === "/api/admin/session") {
    const { default: route } = await import("../server/vercel/adminSession.js");
    return route(req, res);
  }
  if (path === "/api/gate/checkin") {
    const { default: route } = await import("../server/vercel/gateCheckin.js");
    return route(req, res);
  }
  if (path === "/api/management/clients") {
    const { default: route } = await import(
      "../server/vercel/managementClients.js"
    );
    return route(req, res);
  }
  if (path === "/api/management/events") {
    const { default: route } = await import(
      "../server/vercel/managementEvents.js"
    );
    return route(req, res);
  }
  if (path === "/api/management/subaccounts") {
    const { default: route } = await import(
      "../server/vercel/managementSubaccounts.js"
    );
    return route(req, res);
  }

  const eventMatch = path.match(/^\/api\/events\/([^/]+)$/);
  if (eventMatch) {
    req.query.id = decodeURIComponent(eventMatch[1]);
    const { default: route } = await import("../server/vercel/eventById.js");
    return route(req, res);
  }

  res.status(404).json({ error: "API route not found" });
}
