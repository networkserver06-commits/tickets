import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { getAdminUsername } = await import("../../server/adminAuth.ts");
    const username = getAdminUsername(req);
    res.status(200).json(username ? { authenticated: true, user: { username } } : { authenticated: false });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
  }
}
