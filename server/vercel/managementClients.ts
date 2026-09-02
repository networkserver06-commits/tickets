import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createClient,
  deleteClient,
  listClients,
  updateClient,
  validateSubaccountCode,
} from "../multitenant.js";
import { getAdminUsername } from "../adminAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getAdminUsername(req as any)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  if (req.method === "GET") {
    try {
      res.status(200).json({ clients: await listClients() });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Unable to load clients",
      });
    }
    return;
  }
  if (req.method === "DELETE") {
    const id = String(req.query.id || "").trim();
    if (!id) return res.status(400).json({ error: "Client id is required" });
    try {
      return res.status(200).json({ deleted: await deleteClient(id) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete client" });
    }
  }
  if (req.method === "PUT") {
    const body = (req.body || {}) as Record<string, unknown>;
    const id = String(body.id || "").trim();
    if (!id) {
      res.status(400).json({ error: "Client id is required" });
      return;
    }
    try {
      res.status(200).json({
        client: await updateClient(id, {
          businessName: body.businessName
            ? String(body.businessName).trim()
            : undefined,
          email: body.email ? String(body.email).trim() : undefined,
          phone: body.phone ? String(body.phone).trim() : undefined,
          paystackSubaccountCode: body.paystackSubaccountCode
            ? String(body.paystackSubaccountCode).trim()
            : undefined,
          platformFeePercentage:
            body.platformFeePercentage === undefined
              ? undefined
              : Number(body.platformFeePercentage),
        }),
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "Unable to update client",
      });
    }
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  const input = {
    id: String(body.id || `CLI-${Date.now()}`),
    businessName: String(body.businessName || "").trim(),
    email: String(body.email || "").trim(),
    phone: String(body.phone || "").trim(),
    paystackSubaccountCode: String(body.paystackSubaccountCode || "").trim(),
    platformFeePercentage: Number(body.platformFeePercentage ?? 10),
  };
  if (
    !input.businessName ||
    !input.email ||
    !input.phone ||
    !validateSubaccountCode(input.paystackSubaccountCode)
  ) {
    res.status(400).json({
      error:
        "Business name, email, phone, and a valid ACCT_ Paystack subaccount code are required",
    });
    return;
  }
  try {
    res.status(201).json({ client: await createClient(input) });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unable to create client",
    });
  }
}
