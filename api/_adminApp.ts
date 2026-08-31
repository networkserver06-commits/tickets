import express from "express";
import { registerAdminRoutes } from "../server/adminAuth";

const app = express();
app.use(express.json({ limit: "2mb" }));
registerAdminRoutes(app);

export default app;
