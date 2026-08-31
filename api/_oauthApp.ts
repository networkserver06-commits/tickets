import express from "express";
import { registerOAuthRoutes } from "../server/_core/oauth.js";

const app = express();
registerOAuthRoutes(app);

export default app;
