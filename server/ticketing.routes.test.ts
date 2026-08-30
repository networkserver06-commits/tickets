import { describe, expect, it, afterEach } from "vitest";
import { registerTicketingRoutes } from "./ticketing";

type Handler = (req: any, res: any) => unknown;
function harness(db: any) {
  const routes = new Map<string, Handler>();
  const app = { post: (path: string, handler: Handler) => routes.set(`POST ${path}`, handler), get: (path: string, handler: Handler) => routes.set(`GET ${path}`, handler) } as any;
  registerTicketingRoutes(app, () => db);
  return routes;
}
function response() { const result: { status?: number; body?: unknown } = {}; return { result, status(code: number) { result.status = code; return this; }, json(body: unknown) { result.body = body; return this; } }; }

describe("ticketing REST routes", () => {
  afterEach(() => { delete process.env.PAYSTACK_SECRET_KEY; });

  it("rejects a webhook with an invalid signature before touching the database", () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    const routes = harness({ select: () => { throw new Error("database should not be called"); } });
    const res = response();
    routes.get("POST /api/webhook/paystack")!({ body: Buffer.from('{"event":"charge.success"}'), header: () => "bad" }, res);
    expect(res.result).toEqual({ status: 401, body: { error: "Invalid signature" } });
  });

  it("returns not found for a ticket that does not exist", async () => {
    const db = { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) };
    const routes = harness(db);
    const res = response();
    await routes.get("POST /api/tickets/verify")!({ body: { ticketId: "missing" } }, res);
    expect(res.result).toEqual({ status: 404, body: { valid: false, error: "Ticket not found" } });
  });
});
