import express from "express";
import { registerAdminRoutes } from "../server/adminAuth";
import { registerTicketingRoutes } from "../server/ticketing";

const app = express();
app.use("/api/webhook/paystack", express.raw({ type: "application/json", limit: "2mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
registerAdminRoutes(app);
registerTicketingRoutes(app);

export default app;
