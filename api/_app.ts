import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAdminRoutes } from "../server/adminAuth.js";
import { createContext } from "../server/_core/context.js";
import { registerOAuthRoutes } from "../server/_core/oauth.js";
import { registerStorageProxy } from "../server/_core/storageProxy.js";
import { appRouter } from "../server/routers.js";
import { registerTicketingRoutes } from "../server/ticketing.js";

const app = express();
app.use("/api/webhook/paystack", express.raw({ type: "application/json", limit: "2mb" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
registerStorageProxy(app);
registerOAuthRoutes(app);
registerAdminRoutes(app);
registerTicketingRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
