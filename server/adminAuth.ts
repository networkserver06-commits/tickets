import crypto from "node:crypto";
import { parse as parseCookie } from "cookie";
import type { Express, NextFunction, Request, Response } from "express";
import { getSessionCookieOptions } from "./_core/cookies";

export const ADMIN_SESSION_COOKIE = "passage_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type AdminConfig = { username: string; password: string; sessionSecret: string };

function getAdminConfig(): AdminConfig | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password, sessionSecret: process.env.ADMIN_SESSION_SECRET || password };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function createSession(username: string, secret: string) {
  const payload = Buffer.from(username + "|" + (Date.now() + SESSION_TTL_MS), "utf8").toString("base64url");
  return payload + "." + sign(payload, secret);
}

export function getAdminUsername(req: Request): string | null {
  const config = getAdminConfig();
  if (!config) return null;
  const token = parseCookie(req.headers.cookie || "")[ADMIN_SESSION_COOKIE];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, config.sessionSecret))) return null;
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf("|");
    const username = decoded.slice(0, separator);
    const expiresAt = Number(decoded.slice(separator + 1));
    if (separator < 1 || username !== config.username || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    return username;
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!getAdminUsername(req)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

export function registerAdminRoutes(app: Express) {
  app.get("/api/admin/session", (req, res) => {
    const username = getAdminUsername(req);
    res.json(username ? { authenticated: true, user: { username } } : { authenticated: false });
  });

  app.post("/api/admin/login", (req: Request, res: Response) => {
    const config = getAdminConfig();
    if (!config) {
      res.status(503).json({ error: "Admin credentials are not configured" });
      return;
    }
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!safeEqual(username, config.username) || !safeEqual(password, config.password)) {
      res.status(401).json({ error: "Invalid admin username or password" });
      return;
    }
    res.cookie(ADMIN_SESSION_COOKIE, createSession(config.username, config.sessionSecret), {
      ...getSessionCookieOptions(req),
      sameSite: "lax",
      maxAge: SESSION_TTL_MS,
    });
    res.json({ authenticated: true, user: { username: config.username } });
  });

  app.post("/api/admin/logout", (req, res) => {
    res.clearCookie(ADMIN_SESSION_COOKIE, { ...getSessionCookieOptions(req), sameSite: "lax", maxAge: -1 });
    res.json({ success: true });
  });
}
