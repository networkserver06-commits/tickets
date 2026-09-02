import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminUsername } from "../../api/_adminAuth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const username = getAdminUsername(req);
  res
    .status(200)
    .json(
      username
        ? { authenticated: true, user: { username } }
        : { authenticated: false }
    );
}
