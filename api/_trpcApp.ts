import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "../server/_core/context.js";
import { appRouter } from "../server/routers.js";

const app = express();
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
