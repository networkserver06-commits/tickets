import * as crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const ADMIN_SESSION_COOKIE = "passage_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

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

function readCookie(cookieHeader: string | string[] | undefined) {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join(";") : cookieHeader || "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === ADMIN_SESSION_COOKIE) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function getAdminUsername(req: { headers?: { cookie?: string | string[] } }): string | null {
  const config = getAdminConfig();
  if (!config) return null;
  const token = readCookie(req.headers?.cookie);
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

export function authenticateAdmin(username: string, password: string) {
  const config = getAdminConfig();
  if (!config) return { configured: false as const, token: null };
  if (!safeEqual(username, config.username) || !safeEqual(password, config.password)) return { configured: true as const, token: null };
  return { configured: true as const, token: createSession(config.username, config.sessionSecret), username: config.username };
}

export function setAdminCookie(req: { headers?: { [key: string]: string | string[] | undefined } }, res: { setHeader(name: string, value: string): void }, token: string) {
  const forwardedProto = req.headers?.["x-forwarded-proto"];
  const isSecure = Array.isArray(forwardedProto) ? forwardedProto.includes("https") : forwardedProto?.split(",").some(value => value.trim() === "https");
  const cookie = ADMIN_SESSION_COOKIE + "=" + encodeURIComponent(token) + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + SESSION_TTL_SECONDS + (isSecure ? "; Secure" : "");
  res.setHeader("Set-Cookie", cookie);
}

export function clearAdminCookie(res: { setHeader(name: string, value: string): void }) {
  res.setHeader("Set-Cookie", ADMIN_SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!getAdminUsername(req)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}
