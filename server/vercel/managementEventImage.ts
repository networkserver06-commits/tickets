import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storagePut } from "../storage.js";
import { getAdminUsername } from "../adminAuth.js";

const MAX_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getAdminUsername(req as any)) return res.status(401).json({ error: "Admin authentication required" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = (req.body || {}) as Record<string, unknown>;
  const contentType = String(body.contentType || "").toLowerCase();
  const filename = String(body.filename || "event-image").replace(/[^a-z0-9._-]/gi, "-").slice(0, 80);
  const encoded = String(body.data || "");
  if (!allowedTypes.has(contentType)) return res.status(400).json({ error: "Upload a JPG, PNG, or WebP image" });
  if (!encoded || encoded.length > Math.ceil((MAX_BYTES * 4) / 3)) return res.status(413).json({ error: "Image must be 5 MB or smaller" });
  try {
    const buffer = Buffer.from(encoded, "base64");
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return res.status(413).json({ error: "Image must be 5 MB or smaller" });
    const uploaded = await storagePut(`passage/events/${Date.now()}-${filename}`, buffer, contentType);
    res.status(201).json({ imageUrl: uploaded.url });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Unable to upload image" });
  }
}
